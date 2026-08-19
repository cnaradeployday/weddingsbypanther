"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type InitialSupplier = {
  id: string;
  businessName: string;
  legalName: string | null;
  contactFirstName: string | null;
  contactLastName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  vatNumber: string | null;
  headcount: number | null;
  sinceYear: number | null;
  address: string | null;
  city: string | null;
  country: string | null;
  description: string | null;
};

export function SupplierEditForm({ initial }: { initial: InitialSupplier }) {
  const router = useRouter();
  const supabase = createClient();
  const [businessName, setBusinessName] = useState(initial.businessName);
  const [legalName, setLegalName] = useState(initial.legalName ?? "");
  const [contactFirstName, setContactFirstName] = useState(initial.contactFirstName ?? "");
  const [contactLastName, setContactLastName] = useState(initial.contactLastName ?? "");
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [website, setWebsite] = useState(initial.website ?? "");
  const [vatNumber, setVatNumber] = useState(initial.vatNumber ?? "");
  const [headcount, setHeadcount] = useState(initial.headcount != null ? String(initial.headcount) : "");
  const [sinceYear, setSinceYear] = useState(initial.sinceYear != null ? String(initial.sinceYear) : "");
  const [address, setAddress] = useState(initial.address ?? "");
  const [city, setCity] = useState(initial.city ?? "");
  const [country, setCountry] = useState(initial.country ?? "");
  const [description, setDescription] = useState(initial.description ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const { error: updateError } = await supabase
      .from("suppliers")
      .update({
        business_name: businessName,
        legal_name: legalName || null,
        contact_first_name: contactFirstName || null,
        contact_last_name: contactLastName || null,
        phone: phone || null,
        website: website || null,
        vat_number: vatNumber || null,
        headcount: headcount ? Number(headcount) : null,
        since_year: sinceYear ? Number(sinceYear) : null,
        address: address || null,
        city: city || null,
        country: country || null,
        description: description || null,
      })
      .eq("id", initial.id);

    if (updateError) {
      setError(updateError.message);
      setSubmitting(false);
      return;
    }

    router.push("/admin/suppliers");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl rounded-xl border border-line bg-white p-6 space-y-4">
      {initial.email && (
        <div>
          <label className="text-xs text-muted block mb-1">Login email</label>
          <input
            disabled
            value={initial.email}
            className="w-full rounded-lg border border-line px-4 py-3 bg-cream text-muted"
          />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted block mb-1">Business name</label>
          <input
            required
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            className="w-full rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark"
          />
        </div>
        <div>
          <label className="text-xs text-muted block mb-1">Legal name (razón social)</label>
          <input
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
            className="w-full rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted block mb-1">Contact first name</label>
          <input
            value={contactFirstName}
            onChange={(e) => setContactFirstName(e.target.value)}
            className="w-full rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark"
          />
        </div>
        <div>
          <label className="text-xs text-muted block mb-1">Contact last name</label>
          <input
            value={contactLastName}
            onChange={(e) => setContactLastName(e.target.value)}
            className="w-full rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted block mb-1">Phone</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark"
          />
        </div>
        <div>
          <label className="text-xs text-muted block mb-1">Website</label>
          <input
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            className="w-full rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark"
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-muted block mb-1">VAT number</label>
          <input
            value={vatNumber}
            onChange={(e) => setVatNumber(e.target.value)}
            className="w-full rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark"
          />
        </div>
        <div>
          <label className="text-xs text-muted block mb-1">People employed</label>
          <input
            type="number"
            min={0}
            value={headcount}
            onChange={(e) => setHeadcount(e.target.value)}
            className="w-full rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark"
          />
        </div>
        <div>
          <label className="text-xs text-muted block mb-1">Since year</label>
          <input
            type="number"
            min={1900}
            max={2100}
            value={sinceYear}
            onChange={(e) => setSinceYear(e.target.value)}
            className="w-full rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark"
          />
        </div>
      </div>
      <div>
        <label className="text-xs text-muted block mb-1">Address</label>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="w-full rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted block mb-1">City</label>
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-full rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark"
          />
        </div>
        <div>
          <label className="text-xs text-muted block mb-1">Country</label>
          <input
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="w-full rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark"
          />
        </div>
      </div>
      <div>
        <label className="text-xs text-muted block mb-1">What do they make/produce?</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark resize-none"
        />
      </div>
      {error && <p className="text-sm text-terracotta-dark">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full px-6 py-3 rounded-full bg-dark text-cream-light text-sm font-medium hover:bg-dark-soft transition-colors disabled:opacity-50"
      >
        {submitting ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
