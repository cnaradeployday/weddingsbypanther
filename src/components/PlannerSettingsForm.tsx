"use client";

import { useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

export function PlannerSettingsForm({
  plannerId,
  initial,
}: {
  plannerId: string;
  initial: {
    business_name: string;
    tagline: string | null;
    initials: string | null;
    default_markup_pct: number;
    logo_url: string | null;
    accent_color: string;
  };
}) {
  const supabase = createClient();
  const [form, setForm] = useState(initial);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(initial.logo_url);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    let logoUrl = form.logo_url;
    if (logoFile) {
      const ext = logoFile.name.split(".").pop() ?? "png";
      const path = `${plannerId}/logo-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("planner-assets")
        .upload(path, logoFile, { upsert: true });
      if (!uploadError) {
        const { data: publicUrl } = supabase.storage.from("planner-assets").getPublicUrl(path);
        logoUrl = publicUrl.publicUrl;
      }
    }

    await supabase
      .from("planners")
      .update({
        business_name: form.business_name,
        tagline: form.tagline,
        initials: form.initials,
        default_markup_pct: form.default_markup_pct,
        logo_url: logoUrl,
        accent_color: form.accent_color,
      })
      .eq("id", plannerId);

    setForm((f) => ({ ...f, logo_url: logoUrl }));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-4">
      <div>
        <label className="text-xs uppercase tracking-wide text-muted block mb-2">Logo</label>
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full overflow-hidden bg-cream border border-line flex items-center justify-center relative">
            {logoPreview ? (
              <Image src={logoPreview} alt="" fill className="object-cover" unoptimized />
            ) : (
              <span className="font-serif text-sm">{form.initials || "—"}</span>
            )}
          </div>
          <label className="px-4 py-2 rounded-full border border-line text-sm cursor-pointer">
            Upload logo
            <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
          </label>
        </div>
      </div>
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
      <div className="grid grid-cols-3 gap-4">
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
        <div>
          <label className="text-xs uppercase tracking-wide text-muted block mb-1">Accent color</label>
          <div className="flex items-center gap-2 h-[46px]">
            <input
              type="color"
              value={form.accent_color}
              onChange={(e) => setForm((f) => ({ ...f, accent_color: e.target.value }))}
              className="h-10 w-14 rounded border border-line cursor-pointer bg-transparent"
            />
            <span className="text-xs text-muted">{form.accent_color}</span>
          </div>
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
