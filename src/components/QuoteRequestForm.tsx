"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

// A bulk-order enquiry, distinct from checkout — a corporate buyer sizing
// up a large branded-merchandise order usually wants a human quote (freight,
// volume pricing, a purchase-order workflow) before committing, rather than
// paying online for whatever quantity happens to be in the cart.
export function QuoteRequestForm({
  productId,
  productName,
  plannerId,
  defaultQuantity,
}: {
  productId: string;
  productName: string;
  plannerId: string;
  defaultQuantity: number;
}) {
  const [open, setOpen] = useState(false);
  const [contactName, setContactName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [quantity, setQuantity] = useState(String(defaultQuantity));
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full px-6 py-3 rounded-full border border-dark/20 text-sm font-medium hover:border-dark transition-colors"
      >
        Request a volume quote
      </button>
    );
  }

  if (submitted) {
    return (
      <div className="rounded-xl border border-line bg-cream p-5 text-sm">
        <p className="font-medium mb-1">Quote request sent</p>
        <p className="text-muted">Someone will follow up at {email} with pricing for {quantity} units.</p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const parsedQuantity = Number(quantity);
    const { error: insertError } = await supabase.from("quote_requests").insert({
      planner_id: plannerId,
      product_id: productId,
      contact_name: contactName.trim(),
      company_name: companyName.trim() || null,
      email: email.trim(),
      phone: phone.trim() || null,
      quantity: Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? parsedQuantity : defaultQuantity,
      message: message.trim() || null,
    });

    if (insertError) {
      setError("Something went wrong — please try again.");
      setSubmitting(false);
      return;
    }

    setSubmitted(true);
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-line bg-cream p-5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Request a volume quote for {productName}</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-muted hover:text-dark"
          aria-label="Close"
        >
          Cancel
        </button>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <input
          required
          placeholder="Your name"
          value={contactName}
          onChange={(e) => setContactName(e.target.value)}
          className="w-full rounded-lg border border-line px-3 py-2.5 text-sm focus:outline-none focus:border-dark"
        />
        <input
          placeholder="Company"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          className="w-full rounded-lg border border-line px-3 py-2.5 text-sm focus:outline-none focus:border-dark"
        />
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <input
          required
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-line px-3 py-2.5 text-sm focus:outline-none focus:border-dark"
        />
        <input
          type="tel"
          placeholder="Phone (optional)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded-lg border border-line px-3 py-2.5 text-sm focus:outline-none focus:border-dark"
        />
      </div>
      <div>
        <label className="text-xs uppercase tracking-wide text-muted block mb-1">Quantity</label>
        <input
          required
          type="number"
          min={1}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="w-full rounded-lg border border-line px-3 py-2.5 text-sm focus:outline-none focus:border-dark"
        />
      </div>
      <textarea
        placeholder="Anything else — deadline, colors, branding details (optional)"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        className="w-full rounded-lg border border-line px-3 py-2.5 text-sm focus:outline-none focus:border-dark resize-none"
      />
      {error && <p className="text-sm text-terracotta-dark">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full px-6 py-3 rounded-full bg-dark text-cream-light text-sm font-medium hover:bg-dark-soft transition-colors disabled:opacity-50"
      >
        {submitting ? "Sending…" : "Send quote request"}
      </button>
    </form>
  );
}
