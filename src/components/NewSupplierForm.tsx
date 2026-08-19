"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NewSupplierForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [email, setEmail] = useState("");
  const [contactFirstName, setContactFirstName] = useState("");
  const [contactLastName, setContactLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [headcount, setHeadcount] = useState("");
  const [sinceYear, setSinceYear] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ email: string; tempPassword: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const reset = () => {
    setOpen(false);
    setBusinessName("");
    setLegalName("");
    setEmail("");
    setContactFirstName("");
    setContactLastName("");
    setPhone("");
    setWebsite("");
    setVatNumber("");
    setHeadcount("");
    setSinceYear("");
    setAddress("");
    setCity("");
    setCountry("");
    setDescription("");
    setError(null);
    setResult(null);
    setCopied(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/admin/suppliers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessName,
        legalName,
        email,
        fullName: [contactFirstName, contactLastName].filter(Boolean).join(" "),
        contactFirstName,
        contactLastName,
        phone,
        website,
        vatNumber,
        headcount: headcount || null,
        sinceYear: sinceYear || null,
        address,
        city,
        country,
        description,
      }),
    });
    const json = await res.json();

    if (!res.ok) {
      setError(json.error ?? "Could not create the supplier.");
      setSubmitting(false);
      return;
    }

    setResult({ email: json.email, tempPassword: json.tempPassword });
    setSubmitting(false);
    router.refresh();
  };

  const copyPassword = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.tempPassword);
    setCopied(true);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-5 py-2.5 rounded-full bg-dark text-cream-light text-sm font-medium hover:bg-dark-soft transition-colors"
      >
        New supplier
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-dark/40 flex items-center justify-center z-50 px-4 overflow-y-auto py-8">
      <div className="bg-cream-light rounded-2xl border border-line p-6 w-full max-w-lg">
        {result ? (
          <>
            <h2 className="font-serif text-xl mb-2">Supplier created</h2>
            <p className="text-sm text-muted mb-4">
              Share these sign-in details with {result.email}. They&apos;ll be required to set their own
              password the first time they sign in.
            </p>
            <div className="rounded-lg bg-cream border border-line p-4 mb-4 space-y-2">
              <p className="text-xs text-muted uppercase tracking-wide">Email</p>
              <p className="text-sm font-medium break-all">{result.email}</p>
              <p className="text-xs text-muted uppercase tracking-wide mt-2">Temporary password</p>
              <p className="text-sm font-mono font-medium">{result.tempPassword}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={copyPassword}
                className="flex-1 px-4 py-2.5 rounded-full border border-line text-sm font-medium hover:bg-cream transition-colors"
              >
                {copied ? "Copied!" : "Copy password"}
              </button>
              <button
                onClick={reset}
                className="flex-1 px-4 py-2.5 rounded-full bg-dark text-cream-light text-sm font-medium hover:bg-dark-soft transition-colors"
              >
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="font-serif text-xl mb-4">New supplier</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input
                  required
                  placeholder="Business name"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full rounded-lg border border-line px-4 py-2.5 text-sm focus:outline-none focus:border-dark"
                />
                <input
                  placeholder="Legal name (razón social)"
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  className="w-full rounded-lg border border-line px-4 py-2.5 text-sm focus:outline-none focus:border-dark"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  placeholder="Contact first name"
                  value={contactFirstName}
                  onChange={(e) => setContactFirstName(e.target.value)}
                  className="w-full rounded-lg border border-line px-4 py-2.5 text-sm focus:outline-none focus:border-dark"
                />
                <input
                  placeholder="Contact last name"
                  value={contactLastName}
                  onChange={(e) => setContactLastName(e.target.value)}
                  className="w-full rounded-lg border border-line px-4 py-2.5 text-sm focus:outline-none focus:border-dark"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  required
                  type="email"
                  placeholder="Contact email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-line px-4 py-2.5 text-sm focus:outline-none focus:border-dark"
                />
                <input
                  type="tel"
                  placeholder="Phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-lg border border-line px-4 py-2.5 text-sm focus:outline-none focus:border-dark"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  placeholder="Website"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="w-full rounded-lg border border-line px-4 py-2.5 text-sm focus:outline-none focus:border-dark"
                />
                <input
                  placeholder="VAT number"
                  value={vatNumber}
                  onChange={(e) => setVatNumber(e.target.value)}
                  className="w-full rounded-lg border border-line px-4 py-2.5 text-sm focus:outline-none focus:border-dark"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  min={0}
                  placeholder="People directly employed"
                  value={headcount}
                  onChange={(e) => setHeadcount(e.target.value)}
                  className="w-full rounded-lg border border-line px-4 py-2.5 text-sm focus:outline-none focus:border-dark"
                />
                <input
                  type="number"
                  min={1900}
                  max={2100}
                  placeholder="Since year"
                  value={sinceYear}
                  onChange={(e) => setSinceYear(e.target.value)}
                  className="w-full rounded-lg border border-line px-4 py-2.5 text-sm focus:outline-none focus:border-dark"
                />
              </div>
              <input
                placeholder="Address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full rounded-lg border border-line px-4 py-2.5 text-sm focus:outline-none focus:border-dark"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  placeholder="City"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full rounded-lg border border-line px-4 py-2.5 text-sm focus:outline-none focus:border-dark"
                />
                <input
                  placeholder="Country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full rounded-lg border border-line px-4 py-2.5 text-sm focus:outline-none focus:border-dark"
                />
              </div>
              <textarea
                placeholder="What do they make/produce?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-line px-4 py-2.5 text-sm focus:outline-none focus:border-dark resize-none"
              />
              {error && <p className="text-sm text-terracotta-dark">{error}</p>}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={reset}
                  className="flex-1 px-4 py-2.5 rounded-full border border-line text-sm font-medium hover:bg-cream transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 rounded-full bg-dark text-cream-light text-sm font-medium hover:bg-dark-soft transition-colors disabled:opacity-50"
                >
                  {submitting ? "Creating…" : "Create"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
