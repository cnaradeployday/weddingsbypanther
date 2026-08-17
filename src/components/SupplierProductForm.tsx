"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PrintAreaTool } from "./PrintAreaTool";

const TECHNIQUES = ["Foil stamp", "Laser engrave", "Screen print", "Letterpress", "UV print", "Embroidery", "Wax seal"];

function slugify(input: string) {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}

export type ExistingImage = { id: string; url: string };

export type InitialProduct = {
  id: string;
  name: string;
  description: string | null;
  categoryId: string;
  sku: string | null;
  factoryPrice: number;
  minOrder: number;
  leadMin: number;
  leadMax: number;
  stock: number;
  personalizable: boolean;
  status: string;
  reviewerNote: string | null;
  techniques: string[];
  zone: {
    width: number;
    height: number;
    maxChars: number;
    posX: number;
    posY: number;
    widthPct: number;
    heightPct: number;
    imageId: string | null;
  } | null;
  images: ExistingImage[];
  variants: {
    id: string;
    label: string;
    sku: string | null;
    priceDelta: number;
    stock: number | null;
    imageUrl: string | null;
  }[];
};

type VariantRow = {
  localId: string;
  label: string;
  sku: string;
  priceDelta: number;
  stock: string;
  imageUrl: string | null;
  imageFile: File | null;
  imagePreview: string | null;
};

function newVariantRow(): VariantRow {
  return {
    localId: Math.random().toString(36).slice(2),
    label: "",
    sku: "",
    priceDelta: 0,
    stock: "",
    imageUrl: null,
    imageFile: null,
    imagePreview: null,
  };
}

export function SupplierProductForm({
  supplierId,
  categories,
  initial,
}: {
  supplierId: string;
  categories: { id: string; name: string }[];
  initial?: InitialProduct;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? categories[0]?.id ?? "");
  const [sku, setSku] = useState(initial?.sku ?? "");
  const [factoryPrice, setFactoryPrice] = useState(initial?.factoryPrice ?? 5);
  const [minOrder, setMinOrder] = useState(initial?.minOrder ?? 25);
  const [leadMin, setLeadMin] = useState(initial?.leadMin ?? 7);
  const [leadMax, setLeadMax] = useState(initial?.leadMax ?? 10);
  const [stock, setStock] = useState(initial?.stock ?? 1000);
  const [personalizable, setPersonalizable] = useState(initial?.personalizable ?? true);
  const [techniques, setTechniques] = useState<string[]>(initial?.techniques ?? ["Foil stamp"]);
  const [zoneWidth, setZoneWidth] = useState(initial?.zone?.width ?? 60);
  const [zoneHeight, setZoneHeight] = useState(initial?.zone?.height ?? 30);
  const [maxChars, setMaxChars] = useState(initial?.zone?.maxChars ?? 24);
  const [zonePos, setZonePos] = useState({
    posX: initial?.zone?.posX ?? 30,
    posY: initial?.zone?.posY ?? 35,
    width: initial?.zone?.widthPct ?? 40,
    height: initial?.zone?.heightPct ?? 25,
  });
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [existingImages, setExistingImages] = useState<ExistingImage[]>(initial?.images ?? []);
  const [zoneImageId, setZoneImageId] = useState<string | null>(
    initial?.zone?.imageId ?? initial?.images[0]?.id ?? null
  );
  const [variants, setVariants] = useState<VariantRow[]>(
    (initial?.variants ?? []).map((v) => ({
      localId: v.id,
      label: v.label,
      sku: v.sku ?? "",
      priceDelta: v.priceDelta,
      stock: v.stock === null ? "" : String(v.stock),
      imageUrl: v.imageUrl,
      imageFile: null,
      imagePreview: null,
    }))
  );

  const handlePhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const remaining = 4 - existingImages.length;
    const files = Array.from(e.target.files ?? []).slice(0, Math.max(0, remaining));
    setPhotos(files);
    setPreviews(files.map((f) => URL.createObjectURL(f)));
  };

  const removeExistingImage = (id: string) => {
    setExistingImages((prev) => prev.filter((img) => img.id !== id));
    setZoneImageId((prev) => (prev === id ? null : prev));
  };

  const addVariant = () => setVariants((prev) => [...prev, newVariantRow()]);
  const removeVariant = (localId: string) =>
    setVariants((prev) => prev.filter((v) => v.localId !== localId));
  const updateVariant = (localId: string, patch: Partial<VariantRow>) =>
    setVariants((prev) => prev.map((v) => (v.localId === localId ? { ...v, ...patch } : v)));
  const handleVariantImage = (localId: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    updateVariant(localId, { imageFile: file, imagePreview: URL.createObjectURL(file) });
  };

  const toggleTechnique = (t: string) =>
    setTechniques((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    let productId = initial?.id ?? "";

    if (initial) {
      const needsResubmit = initial.status === "draft" || initial.status === "rejected";
      const { error: updateError } = await supabase
        .from("products")
        .update({
          category_id: categoryId,
          description,
          sku: sku || null,
          factory_price: factoryPrice,
          min_order: minOrder,
          lead_time_days_min: leadMin,
          lead_time_days_max: leadMax,
          stock_on_hand: stock,
          personalizable,
          ...(needsResubmit ? { status: "pending", reviewer_note: null } : {}),
        })
        .eq("id", productId);

      if (updateError) {
        setError(updateError.message);
        setSubmitting(false);
        return;
      }

      const removedIds = (initial.images ?? [])
        .filter((img) => !existingImages.find((e) => e.id === img.id))
        .map((img) => img.id);
      if (removedIds.length > 0) {
        await supabase.from("product_images").delete().in("id", removedIds);
      }

      await supabase.from("product_print_techniques").delete().eq("product_id", productId);
      await supabase.from("product_print_zones").delete().eq("product_id", productId);
      await supabase.from("product_variants").delete().eq("product_id", productId);
    } else {
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
      productId = product.id;
    }

    if (photos.length > 0) {
      const startIndex = existingImages.length;
      const uploads = await Promise.all(
        photos.map(async (file, i) => {
          const ext = file.name.split(".").pop() ?? "jpg";
          const path = `${supplierId}/${productId}/${startIndex + i}-${Date.now()}.${ext}`;
          const { error: uploadError } = await supabase.storage
            .from("product-images")
            .upload(path, file);
          if (uploadError) return null;
          const { data: publicUrl } = supabase.storage.from("product-images").getPublicUrl(path);
          return { product_id: productId, url: publicUrl.publicUrl, sort_order: startIndex + i };
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
          product_id: productId,
          technique: t,
          extra_price: 0,
          is_default: i === 0,
        }))
      );
    }

    if (personalizable) {
      await supabase.from("product_print_zones").insert({
        product_id: productId,
        label: "Zone 1",
        width_mm: zoneWidth,
        height_mm: zoneHeight,
        max_chars_per_line: maxChars,
        max_lines: 2,
        pos_x_pct: zonePos.posX,
        pos_y_pct: zonePos.posY,
        width_pct: zonePos.width,
        height_pct: zonePos.height,
        image_id: zoneImageId,
      });
    }

    const namedVariants = variants.filter((v) => v.label.trim());
    if (namedVariants.length > 0) {
      const variantRows = await Promise.all(
        namedVariants.map(async (v, i) => {
          let imageUrl = v.imageUrl;
          if (v.imageFile) {
            const ext = v.imageFile.name.split(".").pop() ?? "jpg";
            const path = `${supplierId}/${productId}/variants/${i}-${Date.now()}.${ext}`;
            const { error: uploadError } = await supabase.storage
              .from("product-images")
              .upload(path, v.imageFile);
            if (!uploadError) {
              const { data: publicUrl } = supabase.storage.from("product-images").getPublicUrl(path);
              imageUrl = publicUrl.publicUrl;
            }
          }
          return {
            product_id: productId,
            label: v.label.trim(),
            sku: v.sku.trim() || null,
            price_delta: v.priceDelta,
            stock_on_hand: v.stock === "" ? null : Number(v.stock),
            image_url: imageUrl,
            sort_order: i,
          };
        })
      );
      await supabase.from("product_variants").insert(variantRows);
    }

    router.push("/supplier/products");
    router.refresh();
  };

  const handleDelete = async () => {
    if (!initial) return;
    if (!confirm(`Delete "${initial.name}"? This can't be undone.`)) return;
    setDeleting(true);
    const { error: deleteError } = await supabase.from("products").delete().eq("id", initial.id);
    if (deleteError) {
      setError(
        deleteError.message.includes("violates foreign key")
          ? "Can't delete — this product has existing orders. Consider unlisting it instead."
          : deleteError.message
      );
      setDeleting(false);
      return;
    }
    router.push("/supplier/products");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl grid md:grid-cols-2 gap-8">
      {initial?.status === "draft" && initial.reviewerNote && (
        <div className="md:col-span-2 rounded-xl border border-gold bg-gold/10 p-4 text-sm">
          <p className="font-medium mb-1">Changes requested</p>
          <p className="text-dark/80">{initial.reviewerNote}</p>
        </div>
      )}

      <div className="rounded-xl border border-line bg-white p-6 space-y-4">
        <p className="text-xs uppercase tracking-wide text-muted">Basics</p>
        <input
          required
          placeholder="Product name"
          value={name}
          disabled={!!initial}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark disabled:bg-cream disabled:text-muted"
        />
        <textarea
          placeholder="Description"
          value={description ?? ""}
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
            value={sku ?? ""}
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
            {existingImages.map((img) => (
              <div key={img.id} className="relative h-16 w-16 rounded-lg overflow-hidden border border-line group">
                <Image src={img.url} alt="" fill className="object-cover" />
                <button
                  type="button"
                  onClick={() => removeExistingImage(img.id)}
                  className="absolute inset-0 bg-black/50 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  Remove
                </button>
              </div>
            ))}
            {previews.map((src, i) => (
              <div key={i} className="relative h-16 w-16 rounded-lg overflow-hidden border border-line">
                <Image src={src} alt="" fill className="object-cover" unoptimized />
              </div>
            ))}
            {existingImages.length + previews.length < 4 && (
              <label className="h-16 w-16 rounded-lg border border-dashed border-line flex items-center justify-center text-xs text-muted cursor-pointer">
                Upload
                <input type="file" accept="image/*" multiple onChange={handlePhotos} className="hidden" />
              </label>
            )}
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
            {existingImages.length > 1 && (
              <div className="mb-3">
                <label className="text-xs uppercase tracking-wide text-muted block mb-2">
                  Reference photo for the print area
                </label>
                <div className="flex gap-2">
                  {existingImages.map((img) => (
                    <button
                      key={img.id}
                      type="button"
                      onClick={() => setZoneImageId(img.id)}
                      className={`relative h-14 w-14 rounded-lg overflow-hidden border-2 ${
                        zoneImageId === img.id ? "border-terracotta" : "border-transparent"
                      }`}
                    >
                      <Image src={img.url} alt="" fill className="object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
            <p className="text-xs uppercase tracking-wide text-muted mb-2">
              Print area — drag to position, drag the corner to resize
            </p>
            <PrintAreaTool
              imageUrl={existingImages.find((i) => i.id === zoneImageId)?.url ?? previews[0] ?? null}
              zone={zonePos}
              onChange={setZonePos}
              sizeLabel={`${zoneWidth} × ${zoneHeight}mm`}
            />
            <div className="grid grid-cols-3 gap-3 mt-3">
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

      </div>

      <div className="md:col-span-2 rounded-xl border border-line bg-white p-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wide text-muted">
            Variants (color, material, etc.) — optional
          </p>
          <button
            type="button"
            onClick={addVariant}
            className="text-xs text-terracotta font-medium"
          >
            + Add variant
          </button>
        </div>
        {variants.length === 0 && (
          <p className="text-sm text-muted">No variants — this product sells as a single option.</p>
        )}
        {variants.map((v) => (
          <div key={v.localId} className="grid grid-cols-[56px_1fr_1fr_100px_90px_auto] gap-3 items-center">
            <label className="relative h-14 w-14 rounded-lg overflow-hidden border border-line cursor-pointer bg-cream">
              {(v.imagePreview ?? v.imageUrl) && (
                <Image src={v.imagePreview ?? v.imageUrl ?? ""} alt="" fill className="object-cover" unoptimized={!!v.imagePreview} />
              )}
              <input type="file" accept="image/*" onChange={handleVariantImage(v.localId)} className="hidden" />
            </label>
            <input
              placeholder="Label (e.g. Walnut)"
              value={v.label}
              onChange={(e) => updateVariant(v.localId, { label: e.target.value })}
              className="rounded-lg border border-line px-3 py-2 text-sm focus:outline-none focus:border-dark"
            />
            <input
              placeholder="SKU"
              value={v.sku}
              onChange={(e) => updateVariant(v.localId, { sku: e.target.value })}
              className="rounded-lg border border-line px-3 py-2 text-sm focus:outline-none focus:border-dark"
            />
            <input
              type="number"
              step="0.01"
              placeholder="+price"
              value={v.priceDelta}
              onChange={(e) => updateVariant(v.localId, { priceDelta: Number(e.target.value) })}
              className="rounded-lg border border-line px-3 py-2 text-sm focus:outline-none focus:border-dark"
            />
            <input
              type="number"
              placeholder="Stock"
              value={v.stock}
              onChange={(e) => updateVariant(v.localId, { stock: e.target.value })}
              className="rounded-lg border border-line px-3 py-2 text-sm focus:outline-none focus:border-dark"
            />
            <button
              type="button"
              onClick={() => removeVariant(v.localId)}
              className="text-xs text-terracotta-dark"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="md:col-span-2">
        {error && <p className="text-sm text-terracotta-dark mb-4">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full px-6 py-3 rounded-full bg-terracotta text-cream-light text-sm font-medium hover:bg-terracotta-dark transition-colors disabled:opacity-50"
        >
          {submitting
            ? "Saving…"
            : initial
            ? initial.status === "draft" || initial.status === "rejected"
              ? "Save & Resubmit"
              : "Save changes"
            : "Submit for Approval"}
        </button>
        {!initial && (
          <p className="text-xs text-muted">
            An admin will review this product before it appears on any storefront.
          </p>
        )}
        {initial && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="w-full text-center text-sm text-terracotta-dark disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete product"}
          </button>
        )}
      </div>
    </form>
  );
}
