"use client";

import { useState } from "react";
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

export function SupplierProductForm({
  supplierId,
  categories,
}: {
  supplierId: string;
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const toggleTechnique = (t: string) =>
    setTechniques((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
        status: "pending",
      })
      .select()
      .single();

    if (productError || !product) {
      setError(productError?.message ?? "Could not save product.");
      setSubmitting(false);
      return;
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

    router.push("/supplier/products");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl grid md:grid-cols-2 gap-8">
      <div className="rounded-xl border border-line bg-white p-6 space-y-4">
        <p className="text-xs uppercase tracking-wide text-muted">Basics</p>
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

        {error && <p className="text-sm text-terracotta-dark">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full px-6 py-3 rounded-full bg-terracotta text-cream-light text-sm font-medium hover:bg-terracotta-dark transition-colors disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit for Approval"}
        </button>
        <p className="text-xs text-muted">
          An admin will review this product before it appears on any storefront.
        </p>
      </div>
    </form>
  );
}
