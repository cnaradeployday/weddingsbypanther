"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";
import { formatUSD } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import { createClient } from "@/lib/supabase/client";
import { COUNTRIES, US_STATES, postalCodeLabel, regionLabel } from "@/lib/geoData";

const SHIPPING_FLAT = 42;
const FREE_SHIPPING_THRESHOLD = 1500;
// Proofs take up to 48h to approve before production even starts — added
// on top of each item's own lead time so "needed by" can't be set to a
// date the studio has no realistic way to hit.
const PROOF_BUFFER_DAYS = 2;

type OtpStage = "idle" | "sent" | "verified";

export function CheckoutForm({ plannerId, plannerSlug }: { plannerId: string; plannerSlug: string }) {
  const router = useRouter();
  const { items, subtotal, personalizationFee, clear } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Quick email verification so the customer can later log back in (with
  // just a code, no password) to check this order's status. Uses the
  // cookie-backed browser client so the resulting session is visible to
  // server components (the order-status page) too.
  const [otpStage, setOtpStage] = useState<OtpStage>("idle");
  const [otpCode, setOtpCode] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);

  // "Today" is read once via a lazy useState initializer rather than
  // directly in the render body — Date.now() is impure, and a lazy
  // initializer is the one place React expects (and permits) a one-time
  // impure read. The minimum allowed date only needs to be roughly
  // current, not millisecond-accurate or reactive to cart changes after
  // the checkout page has already loaded.
  const [minNeededBy] = useState(() => {
    const maxLeadDays = items.length > 0 ? Math.max(...items.map((i) => i.leadTimeMax ?? 10)) : 10;
    return new Date(Date.now() + (maxLeadDays + PROOF_BUFFER_DAYS) * 86400000).toISOString().slice(0, 10);
  });

  const [form, setForm] = useState({
    coupleNames: "",
    weddingDate: "",
    email: "",
    firstName: "",
    lastName: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    country: "US",
    neededByDate: "",
    hasAuthorizedRecipient: false,
    authorizedRecipientName: "",
    cardNumber: "",
    expiry: "",
    cvc: "",
  });

  useEffect(() => {
    const authClient = createClient();
    authClient.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        setCustomerId(data.user.id);
        setOtpStage("verified");
        setForm((f) => (f.email ? f : { ...f, email: data.user.email ?? f.email }));
        const { data: profile } = await authClient
          .from("profiles")
          .select("couple_names, wedding_date")
          .eq("id", data.user.id)
          .maybeSingle();
        if (profile) {
          setForm((f) => ({
            ...f,
            coupleNames: f.coupleNames || profile.couple_names || "",
            weddingDate: f.weddingDate || profile.wedding_date || "",
          }));
        }
      }
    });
  }, []);

  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FLAT;
  const total = subtotal + personalizationFee + shipping;

  const update = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const sendOtpCode = async () => {
    if (!form.email) {
      setOtpError("Enter your email first.");
      return;
    }
    setOtpLoading(true);
    setOtpError(null);
    const authClient = createClient();
    const { error: sendError } = await authClient.auth.signInWithOtp({
      email: form.email,
      options: { shouldCreateUser: true, data: { full_name: `${form.firstName} ${form.lastName}`.trim() } },
    });
    setOtpLoading(false);
    if (sendError) {
      setOtpError(sendError.message);
      return;
    }
    setOtpStage("sent");
  };

  const verifyOtpCode = async () => {
    setOtpLoading(true);
    setOtpError(null);
    const authClient = createClient();
    const { data, error: verifyError } = await authClient.auth.verifyOtp({
      email: form.email,
      token: otpCode,
      type: "email",
    });
    setOtpLoading(false);
    if (verifyError) {
      setOtpError(verifyError.message);
      return;
    }
    setCustomerId(data.user?.id ?? null);
    setOtpStage("verified");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpStage !== "verified") {
      setError("Please verify your email above before placing the order.");
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      // The order row is inserted through the plain anon client (its insert
      // policy is open), but customer_id comes from the verified session so
      // the customer can look this order up later — RLS on SELECT checks
      // orders.customer_id = auth.uid().
      const orderId = crypto.randomUUID();
      const countryName = COUNTRIES.find((c) => c.code === form.country)?.name ?? form.country;
      const { error: orderError } = await supabase.from("orders").insert({
        id: orderId,
        planner_id: plannerId,
        customer_id: customerId,
        customer_name: `${form.firstName} ${form.lastName}`.trim(),
        customer_email: form.email,
        shipping_address: {
          address: form.address,
          city: form.city,
          state: form.state,
          zip: form.zip,
          country: countryName,
          countryCode: form.country,
          phone: form.phone,
        },
        needed_by_date: form.neededByDate || null,
        authorized_recipient: form.hasAuthorizedRecipient ? form.authorizedRecipientName.trim() || null : null,
        subtotal,
        personalization_fee: personalizationFee,
        shipping_fee: shipping,
        tax: 0,
        total,
        payment_status: "paid_test",
        status: "pending_proof",
      });

      if (orderError) throw orderError;

      const orderItems = items.map((item) => ({
        order_id: orderId,
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        variant_id: item.variantId ?? null,
        variant_label: item.variantLabel ?? null,
        personalization: item.personalization ?? null,
      }));

      const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
      if (itemsError) throw itemsError;

      // Best-effort — the couple's names/date carry over to prefill future
      // product personalization, but a failure here shouldn't block the
      // order itself. Needs the cookie-backed client (not the plain anon
      // one above) since the "profiles self update" RLS policy checks
      // auth.uid(), which only that client carries.
      if (customerId && (form.coupleNames.trim() || form.weddingDate)) {
        await createClient()
          .from("profiles")
          .update({
            couple_names: form.coupleNames.trim() || null,
            wedding_date: form.weddingDate || null,
          })
          .eq("id", customerId);
      }

      clear();
      router.push(`/store/${plannerSlug}/checkout/success?order=${orderId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong placing your order.");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-7xl px-6 py-10 grid md:grid-cols-[1fr_380px] gap-12 items-start">
      <div>
        <h1 className="font-serif text-4xl mb-8">Checkout</h1>

        <div className="mb-8">
          <p className="text-xs uppercase tracking-wide text-muted mb-3">Wedding details</p>
          <input
            required
            placeholder="The couple's names (e.g. Amelia & Ravi)"
            value={form.coupleNames}
            onChange={update("coupleNames")}
            className="w-full rounded-lg border border-line px-4 py-3 mb-3 focus:outline-none focus:border-dark"
          />
          <div>
            <label className="text-xs text-muted block mb-1">Wedding date</label>
            <input
              required
              type="date"
              value={form.weddingDate}
              onChange={update("weddingDate")}
              className="w-full rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark"
            />
          </div>
        </div>

        <div className="mb-8">
          <p className="text-xs uppercase tracking-wide text-muted mb-3">Contact</p>
          <input
            required
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => {
              setForm((f) => ({ ...f, email: e.target.value }));
              if (otpStage !== "idle") {
                setOtpStage("idle");
                setCustomerId(null);
                setOtpCode("");
              }
            }}
            className="w-full rounded-lg border border-line px-4 py-3 mb-3 focus:outline-none focus:border-dark"
          />
          <div className="grid grid-cols-3 gap-3 mb-3">
            <input required placeholder="First name" value={form.firstName} onChange={update("firstName")} className="rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark" />
            <input required placeholder="Last name" value={form.lastName} onChange={update("lastName")} className="rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark" />
            <input placeholder="Phone" value={form.phone} onChange={update("phone")} className="rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark" />
          </div>

          {otpStage === "verified" ? (
            <p className="text-sm text-sage flex items-center gap-2">
              <span className="h-4 w-4 rounded-full bg-sage text-cream-light flex items-center justify-center text-[10px]">✓</span>
              Email verified — you can log back in with this address to track your order.
            </p>
          ) : otpStage === "sent" ? (
            <div className="rounded-lg border border-line p-4">
              <p className="text-xs text-muted mb-2">
                We sent a 6-digit code to <span className="font-medium">{form.email}</span>.
              </p>
              <div className="flex gap-2">
                <input
                  inputMode="numeric"
                  placeholder="6-digit code"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  className="flex-1 rounded-lg border border-line px-4 py-2 text-center tracking-[0.3em] focus:outline-none focus:border-dark"
                />
                <button
                  type="button"
                  onClick={verifyOtpCode}
                  disabled={otpLoading || !otpCode}
                  className="px-4 py-2 rounded-lg bg-dark text-cream-light text-sm font-medium hover:bg-dark-soft transition-colors disabled:opacity-50"
                >
                  {otpLoading ? "…" : "Confirm"}
                </button>
              </div>
              {otpError && <p className="text-xs text-terracotta-dark mt-2">{otpError}</p>}
              <button type="button" onClick={sendOtpCode} disabled={otpLoading} className="text-xs text-muted underline underline-offset-2 mt-2">
                Resend code
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={sendOtpCode}
              disabled={otpLoading || !form.email}
              className="w-full rounded-lg border border-dashed border-line px-4 py-3 text-sm font-medium text-dark hover:border-dark transition-colors disabled:opacity-50"
            >
              {otpLoading ? "Sending…" : "Verify email to enable order tracking"}
            </button>
          )}
          {otpStage !== "sent" && otpError && <p className="text-xs text-terracotta-dark mt-2">{otpError}</p>}
        </div>

        <div className="mb-8">
          <p className="text-xs uppercase tracking-wide text-muted mb-3">Shipping address</p>
          <div className="mb-3">
            <label className="text-xs text-muted block mb-1">Country</label>
            <select
              required
              value={form.country}
              onChange={(e) => setForm((f) => ({ ...f, country: e.target.value, state: "" }))}
              className="w-full rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark bg-white"
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          {/* Everything below unlocks once a country is picked — state/city/
              postal code depend on knowing which country's rules to use. */}
          <fieldset disabled={!form.country} className="disabled:opacity-40">
            <input
              required
              placeholder="Street address"
              value={form.address}
              onChange={update("address")}
              className="w-full rounded-lg border border-line px-4 py-3 mb-3 focus:outline-none focus:border-dark"
            />
            <div className="grid grid-cols-4 gap-3">
              <input required placeholder="City" value={form.city} onChange={update("city")} className="rounded-lg border border-line px-4 py-3 col-span-2 focus:outline-none focus:border-dark" />
              {form.country === "US" ? (
                <select
                  required
                  value={form.state}
                  onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                  className="rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark bg-white"
                >
                  <option value="" disabled>
                    State
                  </option>
                  {US_STATES.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  placeholder={regionLabel(form.country)}
                  value={form.state}
                  onChange={update("state")}
                  className="rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark"
                />
              )}
              <input
                required
                placeholder={postalCodeLabel(form.country)}
                value={form.zip}
                onChange={update("zip")}
                className="rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark"
              />
            </div>
          </fieldset>
        </div>

        <div className="mb-8">
          <p className="text-xs uppercase tracking-wide text-muted mb-3">Delivery</p>
          <label className="text-xs text-muted block mb-1">Needed by</label>
          <input
            required
            type="date"
            min={minNeededBy}
            value={form.neededByDate}
            onChange={update("neededByDate")}
            className="w-full rounded-lg border border-line px-4 py-3 mb-1 focus:outline-none focus:border-dark"
          />
          <p className="text-xs text-muted mb-4">
            Earliest possible date, given proofing and production time for what&apos;s in your cart.
          </p>

          <label className="flex items-center gap-2 text-sm mb-2">
            <input
              type="checkbox"
              checked={form.hasAuthorizedRecipient}
              onChange={(e) => setForm((f) => ({ ...f, hasAuthorizedRecipient: e.target.checked }))}
            />
            Someone else is authorized to receive this order
          </label>
          {form.hasAuthorizedRecipient && (
            <input
              placeholder="Their name"
              value={form.authorizedRecipientName}
              onChange={update("authorizedRecipientName")}
              className="w-full rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark"
            />
          )}
        </div>

        <div className="mb-8">
          <p className="text-xs uppercase tracking-wide text-muted mb-3">Payment method</p>
          <div className="rounded-xl border border-dark p-5">
            <p className="text-sm font-medium mb-3">Credit / Debit card (test mode)</p>
            <input
              required
              placeholder="4242 4242 4242 4242"
              value={form.cardNumber}
              onChange={update("cardNumber")}
              className="w-full rounded-lg border border-line px-4 py-3 mb-3 focus:outline-none focus:border-dark"
            />
            <div className="grid grid-cols-2 gap-3">
              <input required placeholder="MM / YY" value={form.expiry} onChange={update("expiry")} className="rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark" />
              <input required placeholder="CVC" value={form.cvc} onChange={update("cvc")} className="rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark" />
            </div>
            <p className="text-xs text-muted mt-3">
              Stripe test mode — no real charge is made. Use any 16-digit number.
            </p>
          </div>
        </div>

        {error && <p className="text-sm text-terracotta-dark mb-4">{error}</p>}

        <button
          type="submit"
          disabled={submitting || items.length === 0 || otpStage !== "verified"}
          className="w-full md:w-auto px-8 py-4 rounded-full bg-terracotta text-cream-light font-medium hover:bg-terracotta-dark transition-colors disabled:opacity-50"
        >
          {submitting ? "Placing order…" : "Place Order"}
        </button>
        <p className="text-xs text-muted mt-3">
          {otpStage !== "verified"
            ? "Verify your email above to place your order."
            : "Proofs are emailed within 48 hours — nothing prints until you approve."}
        </p>
      </div>

      <div className="rounded-2xl bg-cream p-6 sticky top-24">
        <h2 className="font-serif text-2xl mb-5">Order summary</h2>
        <div className="divide-y divide-line/70 mb-5">
          {items.map((item) => (
            <div key={item.key} className="py-3 flex justify-between text-sm">
              <span>
                {item.name}
                <span className="block text-muted">
                  {item.quantity} × {formatUSD(item.unitPrice)}
                </span>
              </span>
              <span>{formatUSD(item.unitPrice * item.quantity)}</span>
            </div>
          ))}
        </div>
        <div className="space-y-2 text-sm mb-4">
          <div className="flex justify-between">
            <span className="text-muted">Subtotal</span>
            <span>{formatUSD(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Personalization</span>
            <span>{formatUSD(personalizationFee)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Shipping</span>
            <span>{shipping === 0 ? "Free" : formatUSD(shipping)}</span>
          </div>
        </div>
        <div className="flex justify-between items-baseline border-t border-line pt-4">
          <span className="font-serif text-lg">Total</span>
          <span className="font-serif text-2xl">{formatUSD(total)}</span>
        </div>
      </div>
    </form>
  );
}
