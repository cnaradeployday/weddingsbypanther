"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NewUserForm({ roles }: { roles: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [roleSelection, setRoleSelection] = useState("none");
  const [wantsPlanner, setWantsPlanner] = useState(false);
  const [plannerName, setPlannerName] = useState("");
  const [wantsSupplier, setWantsSupplier] = useState(false);
  const [supplierName, setSupplierName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ email: string; tempPassword: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const reset = () => {
    setOpen(false);
    setFullName("");
    setEmail("");
    setRoleSelection("none");
    setWantsPlanner(false);
    setPlannerName("");
    setWantsSupplier(false);
    setSupplierName("");
    setError(null);
    setResult(null);
    setCopied(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName,
        email,
        roleSelection,
        plannerName: wantsPlanner ? plannerName : "",
        supplierName: wantsSupplier ? supplierName : "",
      }),
    });
    const json = await res.json();

    if (!res.ok) {
      setError(json.error ?? "Could not create the user.");
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
        New user
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-dark/40 flex items-center justify-center z-50 px-4 overflow-y-auto py-8">
      <div className="bg-cream-light rounded-2xl border border-line p-6 w-full max-w-sm">
        {result ? (
          <>
            <h2 className="font-serif text-xl mb-2">User created</h2>
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
            <h2 className="font-serif text-xl mb-4">New user</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                placeholder="Full name (optional)"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-lg border border-line px-4 py-2.5 text-sm focus:outline-none focus:border-dark"
              />
              <input
                required
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-line px-4 py-2.5 text-sm focus:outline-none focus:border-dark"
              />

              <div>
                <label className="text-xs uppercase tracking-wide text-muted block mb-1">
                  Backoffice access
                </label>
                <select
                  value={roleSelection}
                  onChange={(e) => setRoleSelection(e.target.value)}
                  className="w-full rounded-lg border border-line px-4 py-2.5 text-sm focus:outline-none focus:border-dark"
                >
                  <option value="none">None</option>
                  <option value="super_admin">Super Admin (full access)</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-2 text-sm pt-1">
                <input
                  type="checkbox"
                  checked={wantsPlanner}
                  onChange={(e) => setWantsPlanner(e.target.checked)}
                />
                Also give planner storefront access
              </label>
              {wantsPlanner && (
                <input
                  required
                  placeholder="Studio name"
                  value={plannerName}
                  onChange={(e) => setPlannerName(e.target.value)}
                  className="w-full rounded-lg border border-line px-4 py-2.5 text-sm focus:outline-none focus:border-dark"
                />
              )}

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={wantsSupplier}
                  onChange={(e) => setWantsSupplier(e.target.checked)}
                />
                Also give supplier account access
              </label>
              {wantsSupplier && (
                <input
                  required
                  placeholder="Company name"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  className="w-full rounded-lg border border-line px-4 py-2.5 text-sm focus:outline-none focus:border-dark"
                />
              )}

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
