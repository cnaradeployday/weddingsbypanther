"use client";

import { useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { FONT_CHOICES, FONT_PAIR_VARS } from "@/lib/fontChoices";
import { STOREFRONT_TEMPLATES } from "@/lib/storefrontTemplates";
import { TemplatePreview } from "./TemplatePreview";

type Initial = {
  business_name: string;
  tagline: string | null;
  storefront_subtitle: string | null;
  initials: string | null;
  default_markup_pct: number;
  logo_url: string | null;
  accent_color: string;
  secondary_color: string;
  header_footer_text_color: string;
  font_choice: string;
  template: string;
  storefront_banner_url: string | null;
  catalog_banner_url: string | null;
  ai_render_enabled: boolean;
  about_text: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_address: string | null;
};

async function uploadAsset(
  supabase: ReturnType<typeof createClient>,
  plannerId: string,
  file: File,
  kind: string
): Promise<string | null> {
  const ext = file.name.split(".").pop() ?? "png";
  const path = `${plannerId}/${kind}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("planner-assets").upload(path, file, { upsert: true });
  if (error) return null;
  return supabase.storage.from("planner-assets").getPublicUrl(path).data.publicUrl;
}

function ImagePickerField({
  label,
  hint,
  previewUrl,
  aspectClass,
  onChange,
}: {
  label: string;
  hint?: string;
  previewUrl: string | null;
  aspectClass: string;
  onChange: (file: File) => void;
}) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wide text-muted block mb-2">{label}</label>
      {hint && <p className="text-xs text-muted mb-2">{hint}</p>}
      <label
        className={`relative block w-full ${aspectClass} rounded-xl overflow-hidden border border-dashed border-line cursor-pointer bg-cream hover:border-dark transition-colors`}
      >
        {previewUrl ? (
          <Image src={previewUrl} alt="" fill className="object-cover" unoptimized />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-xs text-muted">
            Click to upload
          </span>
        )}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onChange(file);
          }}
        />
      </label>
    </div>
  );
}

export function PlannerSettingsForm({
  plannerId,
  initial,
  storefrontUrl,
}: {
  plannerId: string;
  initial: Initial;
  // "al lado de los templates, como se ve el front de esa web en
  // cuestion" — the absolute /store/<slug> URL (on the right domain for
  // this planner's own business_type) used to build the live preview
  // iframe next to the template picker below.
  storefrontUrl: string;
}) {
  const supabase = createClient();
  const [form, setForm] = useState(initial);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(initial.logo_url);
  const [storefrontBannerFile, setStorefrontBannerFile] = useState<File | null>(null);
  const [storefrontBannerPreview, setStorefrontBannerPreview] = useState<string | null>(
    initial.storefront_banner_url
  );
  const [catalogBannerFile, setCatalogBannerFile] = useState<File | null>(null);
  const [catalogBannerPreview, setCatalogBannerPreview] = useState<string | null>(initial.catalog_banner_url);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      let logoUrl = form.logo_url;
      if (logoFile) {
        const uploaded = await uploadAsset(supabase, plannerId, logoFile, "logo");
        if (!uploaded) throw new Error("Couldn't upload the logo — try a different image.");
        logoUrl = uploaded;
      }
      let storefrontBannerUrl = form.storefront_banner_url;
      if (storefrontBannerFile) {
        const uploaded = await uploadAsset(supabase, plannerId, storefrontBannerFile, "storefront-banner");
        if (!uploaded) throw new Error("Couldn't upload the storefront banner — try a different image.");
        storefrontBannerUrl = uploaded;
      }
      let catalogBannerUrl = form.catalog_banner_url;
      if (catalogBannerFile) {
        const uploaded = await uploadAsset(supabase, plannerId, catalogBannerFile, "catalog-banner");
        if (!uploaded) throw new Error("Couldn't upload the catalog banner — try a different image.");
        catalogBannerUrl = uploaded;
      }

      const { error: updateError } = await supabase
        .from("planners")
        .update({
          business_name: form.business_name,
          tagline: form.tagline,
          storefront_subtitle: form.storefront_subtitle,
          initials: form.initials,
          default_markup_pct: form.default_markup_pct,
          logo_url: logoUrl,
          accent_color: form.accent_color,
          secondary_color: form.secondary_color,
          header_footer_text_color: form.header_footer_text_color,
          font_choice: form.font_choice,
          storefront_banner_url: storefrontBannerUrl,
          catalog_banner_url: catalogBannerUrl,
          template: form.template,
          ai_render_enabled: form.ai_render_enabled,
          about_text: form.about_text,
          contact_email: form.contact_email,
          contact_phone: form.contact_phone,
          contact_address: form.contact_address,
        })
        .eq("id", plannerId);

      if (updateError) throw updateError;

      setForm((f) => ({
        ...f,
        logo_url: logoUrl,
        storefront_banner_url: storefrontBannerUrl,
        catalog_banner_url: catalogBannerUrl,
      }));
      setLogoFile(null);
      setStorefrontBannerFile(null);
      setCatalogBannerFile(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your changes — try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-6xl space-y-6 pb-24">
      {/* "se ve todo como una columna y hay que scrolear mucho" — grouped
          into cards and laid out two-up on wider screens instead of one
          long single-column stack, so related fields (branding, colors,
          banners, about/contact) sit side by side rather than one after
          another down the page. */}
      <div className="grid lg:grid-cols-2 gap-6 items-start">
        <div className="rounded-xl border border-line bg-white p-6 space-y-4">
          <p className="text-sm font-medium">Branding</p>
          <div>
            <label className="text-xs uppercase tracking-wide text-muted block mb-2">Logo</label>
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full overflow-hidden bg-cream border border-line flex items-center justify-center relative shrink-0">
                {logoPreview ? (
                  <Image src={logoPreview} alt="" fill className="object-cover" unoptimized />
                ) : (
                  <span className="font-serif text-sm">{form.initials || "—"}</span>
                )}
              </div>
              <label className="px-4 py-2 rounded-full border border-line text-sm cursor-pointer">
                Upload logo
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setLogoFile(file);
                    setLogoPreview(URL.createObjectURL(file));
                  }}
                  className="hidden"
                />
              </label>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
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
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-muted block mb-1">Header subtitle</label>
            <input
              value={form.storefront_subtitle ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, storefront_subtitle: e.target.value }))}
              placeholder="Wedding Studio"
              className="w-full rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark"
            />
            <p className="text-xs text-muted mt-1">
              Shown under the store name in the header. Leave blank to use the default for this
              storefront&apos;s type.
            </p>
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
        </div>

        <div className="rounded-xl border border-line bg-white p-6 space-y-4">
          <p className="text-sm font-medium">Colors &amp; font</p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs uppercase tracking-wide text-muted block mb-1">Primary color</label>
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
            <div>
              <label className="text-xs uppercase tracking-wide text-muted block mb-1">Secondary color</label>
              <div className="flex items-center gap-2 h-[46px]">
                <input
                  type="color"
                  value={form.secondary_color}
                  onChange={(e) => setForm((f) => ({ ...f, secondary_color: e.target.value }))}
                  className="h-10 w-14 rounded border border-line cursor-pointer bg-transparent"
                />
                <span className="text-xs text-muted">{form.secondary_color}</span>
              </div>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-muted block mb-1">
                Header &amp; footer text
              </label>
              <div className="flex items-center gap-2 h-[46px]">
                <input
                  type="color"
                  value={form.header_footer_text_color}
                  onChange={(e) => setForm((f) => ({ ...f, header_footer_text_color: e.target.value }))}
                  className="h-10 w-14 rounded border border-line cursor-pointer bg-transparent"
                />
                <span className="text-xs text-muted">{form.header_footer_text_color}</span>
              </div>
            </div>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-muted block mb-2">Storefront font</label>
            <div className="grid grid-cols-2 gap-2">
              {FONT_CHOICES.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, font_choice: opt.id }))}
                  className={`rounded-lg border px-4 py-3 text-left ${
                    form.font_choice === opt.id ? "border-dark bg-cream" : "border-line"
                  }`}
                >
                  <span
                    className="block text-xl leading-tight mb-1"
                    style={{ fontFamily: FONT_PAIR_VARS[opt.id].serif }}
                  >
                    {form.business_name?.trim() || "Amelia & Ravi"}
                  </span>
                  <span className="block font-medium">{opt.label}</span>
                  <span className="block text-xs text-muted">{opt.description}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-white p-6">
        <div className="grid md:grid-cols-[1fr_380px] gap-6 items-start">
          <div>
            <p className="text-sm font-medium mb-3">Storefront template</p>
            <div className="grid grid-cols-3 gap-2">
              {STOREFRONT_TEMPLATES.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, template: opt.id }))}
                  className={`rounded-lg border p-2 text-left ${
                    form.template === opt.id ? "border-dark bg-cream" : "border-line"
                  }`}
                >
                  <TemplatePreview templateId={opt.id} />
                  <span className="block font-medium text-sm mt-2">{opt.label}</span>
                  <span className="block text-[11px] text-muted leading-snug">{opt.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* The actual live storefront (this planner's own data/branding),
              rendered with the currently-selected template via a query
              param the storefront page reads just for this preview — never
              persisted, so clicking around templates before saving costs
              nothing. */}
          <div className="md:sticky md:top-20">
            <label className="text-xs uppercase tracking-wide text-muted block mb-2">
              Live preview — {STOREFRONT_TEMPLATES.find((t) => t.id === form.template)?.label}
            </label>
            <div className="rounded-xl border border-line overflow-hidden shadow-sm bg-cream-light">
              <div className="h-7 bg-cream border-b border-line flex items-center gap-1.5 px-3">
                <span className="h-2 w-2 rounded-full bg-line" />
                <span className="h-2 w-2 rounded-full bg-line" />
                <span className="h-2 w-2 rounded-full bg-line" />
              </div>
              <iframe
                key={form.template}
                src={`${storefrontUrl}?previewTemplate=${form.template}`}
                title="Storefront preview"
                className="w-full h-[480px] bg-white"
              />
            </div>
            <a
              href={storefrontUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-terracotta underline underline-offset-2 mt-2 inline-block"
            >
              Open the live storefront in a new tab ↗
            </a>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 items-start">
        <div className="rounded-xl border border-line bg-white p-6 space-y-4">
          <p className="text-sm font-medium">Banners</p>
          <ImagePickerField
            label="Storefront banner"
            hint="Shown at the top of your store's home page."
            previewUrl={storefrontBannerPreview}
            aspectClass="aspect-[3/1]"
            onChange={(file) => {
              setStorefrontBannerFile(file);
              setStorefrontBannerPreview(URL.createObjectURL(file));
            }}
          />
          <ImagePickerField
            label="Catalog banner"
            hint="Shown above the product grid when browsing/searching."
            previewUrl={catalogBannerPreview}
            aspectClass="aspect-[5/1]"
            onChange={(file) => {
              setCatalogBannerFile(file);
              setCatalogBannerPreview(URL.createObjectURL(file));
            }}
          />
        </div>

        <div className="rounded-xl border border-line bg-white p-6 space-y-4">
          <div>
            <p className="text-sm font-medium">About us page</p>
            <p className="text-xs text-muted">
              Shown at /about on your storefront, linked from the &quot;About us&quot; nav item.
            </p>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-muted block mb-1">About text</label>
            <textarea
              rows={4}
              value={form.about_text ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, about_text: e.target.value }))}
              placeholder="Tell customers who you are and what makes your studio different."
              className="w-full rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs uppercase tracking-wide text-muted block mb-1">Contact email</label>
              <input
                type="email"
                value={form.contact_email ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))}
                className="w-full rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-muted block mb-1">Contact phone</label>
              <input
                value={form.contact_phone ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, contact_phone: e.target.value }))}
                className="w-full rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark"
              />
            </div>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-muted block mb-1">Address</label>
            <input
              value={form.contact_address ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, contact_address: e.target.value }))}
              className="w-full rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-xl border border-line bg-white px-6 py-4">
        <div>
          <p className="text-sm font-medium">AI-generated preview</p>
          <p className="text-xs text-muted">
            Lets customers render their personalization onto the product photo with AI on this
            storefront.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setForm((f) => ({ ...f, ai_render_enabled: !f.ai_render_enabled }))}
          className={`h-6 w-11 shrink-0 rounded-full transition-colors relative ${
            form.ai_render_enabled ? "bg-sage" : "bg-line"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
              form.ai_render_enabled ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {/* Sticky so Save stays reachable without scrolling back up or down
          through every section above, now that the form is several cards
          tall instead of one long column. */}
      <div className="sticky bottom-0 -mx-6 sm:mx-0 bg-cream-light/95 backdrop-blur border-t border-line sm:border-t-0 sm:bg-transparent sm:backdrop-blur-none px-6 sm:px-0 py-4 sm:py-0 flex items-center gap-4">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-3 rounded-full bg-dark text-cream-light text-sm font-medium hover:bg-dark-soft transition-colors disabled:opacity-50"
        >
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save changes"}
        </button>
        {error && <p className="text-sm text-terracotta-dark">{error}</p>}
      </div>
    </form>
  );
}
