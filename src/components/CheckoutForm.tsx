"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";
import { formatUSD } from "@/lib/format";
import { supabase } from "@/lib/supabase";

const SHIPPING_FLAT = 42;
const FREE_SHIPPING_THRESHOLD = 1500;

export function CheckoutForm({ plannerId, plannerSlug }: { plannerId: string; plannerSlug: string }) {
  const router = useRouter();
  const { items, subtotal, personalizationFee, clear } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    email: "",
    firstName: "",
    lastName: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    country: "United States",
    cardNumber: "",
    expiry: "",
    cvc: "",
  });

  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FLAT;
  const total = subtotal + personalizationFee + shipping;

  const update = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          planner_id: plannerId,
          customer_name: `${form.firstName} ${form.lastName}`.trim(),
          customer_email: form.email,
          shipping_address: {
            address: form.address,
            city: form.city,
            state: form.state,
            zip: form.zip,
            country: form.country,
            phone: form.phone,
          },
          subtotal,
          personalization_fee: personalizationFee,
          shipping_fee: shipping,
          tax: 0,
          total,
          payment_status: "paid_test",
          status: "pending_proof",
        })
        .select()
        .single();

      if (orderError || !order) throw orderError ?? new Error("Could not create order");

      const orderItems = items.map((item) => ({
        order_id: order.id,
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        variant_id: item.variantId ?? null,
        variant_label: item.variantLabel ?? null,
        personalization: item.personalization ?? null,
      }));

      const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
      if (itemsError) throw itemsError;

      clear();
      router.push(`/store/${plannerSlug}/checkout/success?order=${order.id}`);
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
          <p className="text-xs uppercase tracking-wide text-muted mb-3">Contact</p>
          <input
            required
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={update("email")}
            className="w-full rounded-lg border border-line px-4 py-3 mb-3 focus:outline-none focus:border-dark"
          />
          <div className="grid grid-cols-3 gap-3">
            <input required placeholder="First name" value={form.firstName} onChange={update("firstName")} className="rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark" />
            <input required placeholder="Last name" value={form.lastName} onChange={update("lastName")} className="rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark" />
            <input placeholder="Phone" value={form.phone} onChange={update("phone")} className="rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark" />
          </div>
        </div>

        <div className="mb-8">
          <p className="text-xs uppercase tracking-wide text-muted mb-3">Shipping address</p>
          <input required placeholder="Street address" value={form.address} onChange={update("address")} className="w-full rounded-lg border border-line px-4 py-3 mb-3 focus:outline-none focus:border-dark" />
          <div className="grid grid-cols-4 gap-3">
            <input required placeholder="City" value={form.city} onChange={update("city")} className="rounded-lg border border-line px-4 py-3 col-span-2 focus:outline-none focus:border-dark" />
            <input required placeholder="State" value={form.state} onChange={update("state")} className="rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark" />
            <input required placeholder="ZIP" value={form.zip} onChange={update("zip")} className="rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark" />
          </div>
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
          disabled={submitting || items.length === 0}
          className="w-full md:w-auto px-8 py-4 rounded-full bg-terracotta text-cream-light font-medium hover:bg-terracotta-dark transition-colors disabled:opacity-50"
        >
          {submitting ? "Placing order…" : "Place Order"}
        </button>
        <p className="text-xs text-muted mt-3">
          Proofs are emailed within 48 hours — nothing prints until you approve.
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
