"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NewPlannerForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ email: string; tempPassword: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const reset = () => {
    setOpen(false);
    setBusinessName("");
    setEmail("");
    setFullName("");
    setError(null);
    setResult(null);
    setCopied(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/admin/planners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessName, email, fullName }),
    });
    const json = await res.json();

    if (!res.ok) {
      setError(json.error ?? "Could not create the planner.");
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
        New planner
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-dark/40 flex items-center justify-center z-50 px-4">
      <div className="bg-cream-light rounded-2xl border border-line p-6 w-full max-w-sm">
        {result ? (
          <>
            <h2 className="font-serif text-xl mb-2">Planner created</h2>
            <p className="text-sm text-muted mb-4">
              Share these sign-in details with {result.email}. They&apos;ll be required to set their own
              password the first time they sign in. You can fill in the rest of their storefront (logo,
              accent color, markup) from the edit page any time.
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
            <h2 className="font-serif text-xl mb-4">New planner</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                required
                placeholder="Studio name"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full rounded-lg border border-line px-4 py-2.5 text-sm focus:outline-none focus:border-dark"
              />
              <input
                required
                type="email"
                placeholder="Contact email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-line px-4 py-2.5 text-sm focus:outline-none focus:border-dark"
              />
              <input
                placeholder="Contact name (optional)"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-lg border border-line px-4 py-2.5 text-sm focus:outline-none focus:border-dark"
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
