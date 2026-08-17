"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function slugify(input: string) {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}

export function UserAccessForm({
  profile,
  roles,
  planner,
  supplier,
}: {
  profile: { id: string; email: string | null; full_name: string | null; role: string; role_id: string | null };
  roles: { id: string; name: string }[];
  planner: { id: string; business_name: string } | null;
  supplier: { id: string; business_name: string } | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [selection, setSelection] = useState(
    profile.role === "admin" ? "super_admin" : profile.role_id ?? "none"
  );
  const [saving, setSaving] = useState(false);
  const [newPlannerName, setNewPlannerName] = useState("");
  const [newSupplierName, setNewSupplierName] = useState("");
  const [busy, setBusy] = useState(false);

  const saveRole = async () => {
    setSaving(true);
    if (selection === "super_admin") {
      await supabase.from("profiles").update({ role: "admin", role_id: null }).eq("id", profile.id);
    } else if (selection === "none") {
      await supabase
        .from("profiles")
        .update({ role_id: null, role: profile.role === "admin" ? "customer" : profile.role })
        .eq("id", profile.id);
    } else {
      await supabase
        .from("profiles")
        .update({ role_id: selection, role: profile.role === "admin" ? "customer" : profile.role })
        .eq("id", profile.id);
    }
    setSaving(false);
    router.refresh();
  };

  const linkPlanner = async () => {
    if (!newPlannerName.trim()) return;
    setBusy(true);
    await supabase.from("planners").insert({
      profile_id: profile.id,
      business_name: newPlannerName.trim(),
      slug: slugify(newPlannerName),
      status: "approved",
    });
    setBusy(false);
    setNewPlannerName("");
    router.refresh();
  };

  const unlinkPlanner = async () => {
    if (!planner) return;
    if (!confirm(`Remove ${profile.email}'s access to the "${planner.business_name}" storefront? The storefront and its data stay intact.`)) return;
    setBusy(true);
    await supabase.from("planners").update({ profile_id: null }).eq("id", planner.id);
    setBusy(false);
    router.refresh();
  };

  const linkSupplier = async () => {
    if (!newSupplierName.trim()) return;
    setBusy(true);
    await supabase.from("suppliers").insert({
      profile_id: profile.id,
      business_name: newSupplierName.trim(),
      slug: slugify(newSupplierName),
      status: "approved",
    });
    setBusy(false);
    setNewSupplierName("");
    router.refresh();
  };

  const unlinkSupplier = async () => {
    if (!supplier) return;
    if (!confirm(`Remove ${profile.email}'s access as "${supplier.business_name}"? Their products stay intact.`)) return;
    setBusy(true);
    await supabase.from("suppliers").update({ profile_id: null }).eq("id", supplier.id);
    setBusy(false);
    router.refresh();
  };

  return (
    <div className="max-w-xl space-y-8">
      <div className="rounded-xl border border-line bg-white p-6">
        <p className="text-xs uppercase tracking-wide text-muted mb-3">Backoffice access</p>
        <div className="flex items-center gap-3">
          <select
            value={selection}
            onChange={(e) => setSelection(e.target.value)}
            className="flex-1 rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark"
          >
            <option value="none">None</option>
            <option value="super_admin">Super Admin (full access)</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <button
            onClick={saveRole}
            disabled={saving}
            className="px-5 py-3 rounded-full bg-dark text-cream-light text-sm font-medium hover:bg-dark-soft transition-colors disabled:opacity-50 shrink-0"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-white p-6">
        <p className="text-xs uppercase tracking-wide text-muted mb-3">Planner storefront</p>
        {planner ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{planner.business_name}</p>
              <p className="text-xs text-muted">This account can manage this storefront.</p>
            </div>
            <button onClick={unlinkPlanner} disabled={busy} className="text-sm text-terracotta-dark disabled:opacity-50">
              Remove access
            </button>
          </div>
        ) : (
          <div className="flex gap-3">
            <input
              placeholder="Studio name"
              value={newPlannerName}
              onChange={(e) => setNewPlannerName(e.target.value)}
              className="flex-1 rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark"
            />
            <button
              onClick={linkPlanner}
              disabled={busy || !newPlannerName.trim()}
              className="px-5 py-3 rounded-full border border-dark text-sm font-medium disabled:opacity-50 shrink-0"
            >
              Grant planner access
            </button>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-line bg-white p-6">
        <p className="text-xs uppercase tracking-wide text-muted mb-3">Supplier account</p>
        {supplier ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{supplier.business_name}</p>
              <p className="text-xs text-muted">This account can manage this supplier&apos;s products.</p>
            </div>
            <button onClick={unlinkSupplier} disabled={busy} className="text-sm text-terracotta-dark disabled:opacity-50">
              Remove access
            </button>
          </div>
        ) : (
          <div className="flex gap-3">
            <input
              placeholder="Company name"
              value={newSupplierName}
              onChange={(e) => setNewSupplierName(e.target.value)}
              className="flex-1 rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark"
            />
            <button
              onClick={linkSupplier}
              disabled={busy || !newSupplierName.trim()}
              className="px-5 py-3 rounded-full border border-dark text-sm font-medium disabled:opacity-50 shrink-0"
            >
              Grant supplier access
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
