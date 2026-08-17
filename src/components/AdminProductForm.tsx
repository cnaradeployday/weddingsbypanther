"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const TECHNIQUES = ["Foil stamp", "Laser engrave", "Screen print", "Letterpress", "UV print", "Embroidery", "Wax seal"];

function slugify(input: string) {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}

export function AdminProductForm({
  suppliers,
  categories,
}: {
  suppliers: { id: string; business_name: string }[];
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [sku, setSku] = useState("");
  const [factoryPrice, setFactoryPrice] = useState(5);
  const [minOrder, setMinOrder] = useState(25);
  const [leadMin, setLeadMin] = useState(7);
  const [leadMax, setLeadMax] = useState(10);
  const [stock, setStock] = useState(1000);
  const [personalizable, setPersonalizable] = useState(true);
  const [techniques, setTechniques] = useState<string[]>(["Foil stamp"]);
  const [zoneWidth, setZoneWidth] = useState(60);
  const [zoneHeight, setZoneHeight] = useState(30);
  const [maxChars, setMaxChars] = useState(24);
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [addToPlanners, setAddToPlanners] = useState(true);

  const handlePhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, 4);
    setPhotos(files);
    setPreviews(files.map((f) => URL.createObjectURL(f)));
  };

  const toggleTechnique = (t: string) =>
    setTechniques((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) {
      setError("Add a supplier first — every product needs one.");
      return;
    }
    setSubmitting(true);
    setError(null);

    const { data: product, error: productError } = await supabase
      .from("products")
      .insert({
        supplier_id: supplierId,
        category_id: categoryId,
        name,
        slug: slugify(name),
        description,
        sku: sku || null,
        factory_price: factoryPrice,
        min_order: minOrder,
        lead_time_days_min: leadMin,
        lead_time_days_max: leadMax,
        stock_on_hand: stock,
        personalizable,
        status: "approved",
      })
      .select()
      .single();

    if (productError || !product) {
      setError(productError?.message ?? "Could not save product.");
      setSubmitting(false);
      return;
    }

    if (photos.length > 0) {
      const uploads = await Promise.all(
        photos.map(async (file, i) => {
          const ext = file.name.split(".").pop() ?? "jpg";
          const path = `${supplierId}/${product.id}/${i}-${Date.now()}.${ext}`;
          const { error: uploadError } = await supabase.storage
            .from("product-images")
            .upload(path, file);
          if (uploadError) return null;
          const { data: publicUrl } = supabase.storage.from("product-images").getPublicUrl(path);
          return { product_id: product.id, url: publicUrl.publicUrl, sort_order: i };
        })
      );
      const rows = uploads.filter((r): r is NonNullable<typeof r> => r !== null);
      if (rows.length > 0) {
        await supabase.from("product_images").insert(rows);
      }
    }

    if (techniques.length > 0) {
      await supabase.from("product_print_techniques").insert(
        techniques.map((t, i) => ({
          product_id: product.id,
          technique: t,
          extra_price: 0,
          is_default: i === 0,
        }))
      );
    }

    if (personalizable) {
      await supabase.from("product_print_zones").insert({
        product_id: product.id,
        label: "Zone 1",
        width_mm: zoneWidth,
        height_mm: zoneHeight,
        max_chars_per_line: maxChars,
        max_lines: 2,
      });
    }

    if (addToPlanners) {
      const { data: planners } = await supabase.from("planners").select("id, default_markup_pct");
      if (planners && planners.length > 0) {
        await supabase.from("planner_products").insert(
          planners.map((p) => ({
            planner_id: p.id,
            product_id: product.id,
            markup_pct: p.default_markup_pct,
            enabled: true,
          }))
        );
      }
    }

    router.push("/admin/products");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl grid md:grid-cols-2 gap-8">
      <div className="rounded-xl border border-line bg-white p-6 space-y-4">
        <p className="text-xs uppercase tracking-wide text-muted">Basics</p>
        <select
          value={supplierId}
          onChange={(e) => setSupplierId(e.target.value)}
          className="w-full rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark"
        >
          {suppliers.length === 0 && <option value="">No suppliers yet</option>}
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.business_name}
            </option>
          ))}
        </select>
        <input
          required
          placeholder="Product name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark"
        />
        <textarea
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark"
        />
        <div className="grid grid-cols-2 gap-3">
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            placeholder="SKU"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            className="rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark"
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-muted block mb-1">Factory price</label>
            <input
              type="number"
              step="0.01"
              value={factoryPrice}
              onChange={(e) => setFactoryPrice(Number(e.target.value))}
              className="w-full rounded-lg border border-line px-3 py-2 focus:outline-none focus:border-dark"
            />
          </div>
          <div>
            <label className="text-xs text-muted block mb-1">Stock</label>
            <input
              type="number"
              value={stock}
              onChange={(e) => setStock(Number(e.target.value))}
              className="w-full rounded-lg border border-line px-3 py-2 focus:outline-none focus:border-dark"
            />
          </div>
          <div>
            <label className="text-xs text-muted block mb-1">Min order</label>
            <input
              type="number"
              value={minOrder}
              onChange={(e) => setMinOrder(Number(e.target.value))}
              className="w-full rounded-lg border border-line px-3 py-2 focus:outline-none focus:border-dark"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted block mb-1">Lead time min (days)</label>
            <input
              type="number"
              value={leadMin}
              onChange={(e) => setLeadMin(Number(e.target.value))}
              className="w-full rounded-lg border border-line px-3 py-2 focus:outline-none focus:border-dark"
            />
          </div>
          <div>
            <label className="text-xs text-muted block mb-1">Lead time max (days)</label>
            <input
              type="number"
              value={leadMax}
              onChange={(e) => setLeadMax(Number(e.target.value))}
              className="w-full rounded-lg border border-line px-3 py-2 focus:outline-none focus:border-dark"
            />
          </div>
        </div>

        <div>
          <label className="text-xs uppercase tracking-wide text-muted block mb-2">
            Photos (up to 4)
          </label>
          <div className="flex flex-wrap gap-3">
            {previews.map((src, i) => (
              <div key={i} className="relative h-16 w-16 rounded-lg overflow-hidden border border-line">
                <Image src={src} alt="" fill className="object-cover" unoptimized />
              </div>
            ))}
            <label className="h-16 w-16 rounded-lg border border-dashed border-line flex items-center justify-center text-xs text-muted cursor-pointer">
              Upload
              <input type="file" accept="image/*" multiple onChange={handlePhotos} className="hidden" />
            </label>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-white p-6 space-y-5">
        <p className="text-xs uppercase tracking-wide text-muted">Print techniques</p>
        <div className="flex flex-wrap gap-2">
          {TECHNIQUES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => toggleTechnique(t)}
              className={`px-3 py-2 rounded-lg text-sm border ${
                techniques.includes(t) ? "border-dark bg-cream" : "border-line"
              }`}
            >
              {t} {techniques.includes(t) ? "✓" : ""}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={personalizable}
            onChange={(e) => setPersonalizable(e.target.checked)}
          />
          This product can be personalized
        </label>

        {personalizable && (
          <div>
            <p className="text-xs uppercase tracking-wide text-muted mb-2">Print area</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted block mb-1">Width (mm)</label>
                <input
                  type="number"
                  value={zoneWidth}
                  onChange={(e) => setZoneWidth(Number(e.target.value))}
                  className="w-full rounded-lg border border-line px-3 py-2 focus:outline-none focus:border-dark"
                />
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Height (mm)</label>
                <input
                  type="number"
                  value={zoneHeight}
                  onChange={(e) => setZoneHeight(Number(e.target.value))}
                  className="w-full rounded-lg border border-line px-3 py-2 focus:outline-none focus:border-dark"
                />
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Max chars/line</label>
                <input
                  type="number"
                  value={maxChars}
                  onChange={(e) => setMaxChars(Number(e.target.value))}
                  className="w-full rounded-lg border border-line px-3 py-2 focus:outline-none focus:border-dark"
                />
              </div>
            </div>
          </div>
        )}

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={addToPlanners}
            onChange={(e) => setAddToPlanners(e.target.checked)}
          />
          Enable on every planner storefront at their default markup
        </label>

        {error && <p className="text-sm text-terracotta-dark">{error}</p>}

        <button
          type="submit"
          disabled={submitting || suppliers.length === 0}
          className="w-full px-6 py-3 rounded-full bg-sage text-cream-light text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {submitting ? "Publishing…" : "Publish product"}
        </button>
        <p className="text-xs text-muted">
          Products you add here are approved immediately — no review queue.
        </p>
      </div>
    </form>
  );
}
