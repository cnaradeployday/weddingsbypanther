"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import type { BusinessType } from "@/lib/businessType";

export function BecomePlannerForm({ businessType }: { businessType: BusinessType }) {
  const [contactName, setContactName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [yearsInBusiness, setYearsInBusiness] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const { error: insertError } = await supabase.from("planner_leads").insert({
      contact_name: contactName.trim(),
      business_name: businessName.trim(),
      email: email.trim(),
      phone: phone.trim() || null,
      website: website.trim() || null,
      address: address.trim() || null,
      city: city.trim() || null,
      country: country.trim() || null,
      years_in_business: yearsInBusiness ? Number(yearsInBusiness) : null,
      message: message.trim() || null,
      business_type: businessType,
    });

    if (insertError) {
      setError("Something went wrong — please try again.");
      setSubmitting(false);
      return;
    }

    setSubmitted(true);
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <div className="bg-cream-light rounded-2xl border border-line p-8 text-center">
        <h2 className="font-serif text-2xl mb-2">Thanks for reaching out</h2>
        <p className="text-muted">
          Someone from the Bespoke team will review your application and get back to you at{" "}
          {email}.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-cream-light rounded-2xl border border-line p-8 space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <input
          required
          placeholder="Your name"
          value={contactName}
          onChange={(e) => setContactName(e.target.value)}
          className="w-full rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark"
        />
        <input
          required
          placeholder="Business / studio name"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          className="w-full rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark"
        />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <input
          required
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark"
        />
        <input
          required
          type="tel"
          placeholder="Phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark"
        />
      </div>
      <input
        placeholder="Website (optional)"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        className="w-full rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark"
      />
      <input
        placeholder="Address"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        className="w-full rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark"
      />
      <div className="grid sm:grid-cols-3 gap-4">
        <input
          placeholder="City"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="w-full rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark"
        />
        <input
          placeholder="Country"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="w-full rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark"
        />
        <input
          type="number"
          min={0}
          placeholder="Years in the industry"
          value={yearsInBusiness}
          onChange={(e) => setYearsInBusiness(e.target.value)}
          className="w-full rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark"
        />
      </div>
      <textarea
        placeholder="Tell us a bit about your business (optional)"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        className="w-full rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark resize-none"
      />
      {error && <p className="text-sm text-terracotta-dark">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full px-6 py-3 rounded-full bg-terracotta text-cream-light text-sm font-medium hover:bg-terracotta-dark transition-colors disabled:opacity-50"
      >
        {submitting ? "Sending…" : "Submit application"}
      </button>
    </form>
  );
}
