"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function PlannerSettingsForm({
  plannerId,
  initial,
}: {
  plannerId: string;
  initial: { business_name: string; tagline: string | null; initials: string | null; default_markup_pct: number };
}) {
  const supabase = createClient();
  const [form, setForm] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await supabase
      .from("planners")
      .update({
        business_name: form.business_name,
        tagline: form.tagline,
        initials: form.initials,
        default_markup_pct: form.default_markup_pct,
      })
      .eq("id", plannerId);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-4">
      <div>
        <label className="text-xs uppercase tracking-wide text-muted block mb-1">Studio name</label>
        <input
          value={form.business_name}
          onChange={(e) => setForm((f) => ({ ...f, business_name: e.target.value }))}
          className="w-full rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark"
        />
      </div>
      <div>
        <label className="text-xs uppercase tracking-wide text-muted block mb-1">Tagline</label>
        <input
          value={form.tagline ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))}
          className="w-full rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs uppercase tracking-wide text-muted block mb-1">Initials</label>
          <input
            value={form.initials ?? ""}
            maxLength={3}
            onChange={(e) => setForm((f) => ({ ...f, initials: e.target.value }))}
            className="w-full rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-muted block mb-1">Default markup %</label>
          <input
            type="number"
            value={form.default_markup_pct}
            onChange={(e) => setForm((f) => ({ ...f, default_markup_pct: Number(e.target.value) }))}
            className="w-full rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark"
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={saving}
        className="px-6 py-3 rounded-full bg-dark text-cream-light text-sm font-medium hover:bg-dark-soft transition-colors disabled:opacity-50"
      >
        {saving ? "Saving…" : saved ? "Saved ✓" : "Save changes"}
      </button>
    </form>
  );
}
