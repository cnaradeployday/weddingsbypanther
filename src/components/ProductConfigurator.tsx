"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { formatUSD } from "@/lib/format";
import { applyMarkup } from "@/lib/format";
import { useCart } from "@/lib/cart";
import { AiRenderPanel } from "./AiRenderPanel";

const MONOGRAMS = ["✦", "❀", "❖", "⬥", "✿", "☙"];

type Technique = { id: string; technique: string; extra_price: number; is_default: boolean };
type ProductImage = { id: string; url: string };
type Variant = {
  id: string;
  label: string;
  sku: string | null;
  price_delta: number;
  image_url: string | null;
  sort_order: number;
};
type Zone = {
  id: string;
  label: string;
  max_chars_per_line: number | null;
  width_mm: number | null;
  height_mm: number | null;
  pos_x_pct: number;
  pos_y_pct: number;
  width_pct: number;
  height_pct: number;
  image_id: string | null;
};

// Measures the rendered zone box so text/logo sizing can be derived from the
// product's real print-area dimensions (mm), not a guessed fixed size.
function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, size] as const;
}

export function ProductConfigurator({
  product,
}: {
  product: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    categoryName: string;
    supplierName: string;
    factoryPrice: number;
    markupPct: number;
    unitPrice: number;
    minOrder: number;
    leadTimeMin: number;
    leadTimeMax: number;
    personalizable: boolean;
    images: ProductImage[];
    techniques: Technique[];
    zones: Zone[];
    variants: Variant[];
    plannerSlug: string;
  };
}) {
  const router = useRouter();
  const { addItem } = useCart();

  const [names, setNames] = useState("Amelia & Ravi");
  const [date, setDate] = useState("2026-06-14");
  const [monogram, setMonogram] = useState(MONOGRAMS[0]);
  const [techniqueId, setTechniqueId] = useState(
    product.techniques.find((t) => t.is_default)?.id ?? product.techniques[0]?.id ?? ""
  );
  const [variantId, setVariantId] = useState(product.variants[0]?.id ?? "");
  const [quantity, setQuantity] = useState(product.minOrder);
  const [justAdded, setJustAdded] = useState(false);

  const zone = product.zones[0];
  const zoneImageIndex = zone?.image_id ? product.images.findIndex((i) => i.id === zone.image_id) : -1;
  const [activeImage, setActiveImage] = useState(zoneImageIndex >= 0 ? zoneImageIndex : 0);

  const [zoneRef, zoneSize] = useElementSize<HTMLDivElement>();

  const technique = product.techniques.find((t) => t.id === techniqueId);
  const variant = product.variants.find((v) => v.id === variantId);

  const basePrice = product.factoryPrice + (variant?.price_delta ?? 0);
  const unitPriceWithVariant = applyMarkup(basePrice, product.markupPct);
  const unitPriceWithTechnique = unitPriceWithVariant + (technique?.extra_price ?? 0);
  const total = unitPriceWithTechnique * quantity;

  const displayImage = variant?.image_url ?? product.images[activeImage]?.url ?? product.images[0]?.url;
  const showOverlayHere = !zone?.image_id || product.images[activeImage]?.id === zone.image_id;

  // Real px-per-mm for the currently rendered zone box, so text/logo sizing
  // reflects the product's actual printable area instead of a fixed guess.
  const mmPerPx = useMemo(() => {
    if (!zone?.width_mm || !zoneSize.width) return null;
    return zone.width_mm / zoneSize.width;
  }, [zone?.width_mm, zoneSize.width]);
  const pxPerMm = mmPerPx ? 1 / mmPerPx : null;
  const nameFontPx = pxPerMm ? Math.max(10, Math.min(28, pxPerMm * 5)) : 18;
  const monogramFontPx = pxPerMm ? Math.max(12, Math.min(32, pxPerMm * 6)) : 20;
  const dateFontPx = pxPerMm ? Math.max(8, Math.min(14, pxPerMm * 2.4)) : 11;

  const formattedDate = useMemo(() => {
    if (!date) return "";
    const d = new Date(date + "T00:00:00");
    if (Number.isNaN(d.getTime())) return date;
    return d
      .toLocaleDateString("en-US", { day: "2-digit", month: "2-digit", year: "numeric" })
      .replace(/\//g, "·");
  }, [date]);

  const quickQuantities = [product.minOrder, product.minOrder * 2, product.minOrder * 4, product.minOrder * 8];

  const handleAddToCart = () => {
    addItem({
      key: `${product.id}:${variantId}:${names}:${date}:${monogram}:${techniqueId}`,
      productId: product.id,
      slug: product.slug,
      name: variant ? `${product.name} — ${variant.label}` : product.name,
      image: displayImage ?? null,
      unitPrice: unitPriceWithTechnique,
      quantity,
      minOrder: product.minOrder,
      variantId: variant?.id,
      variantLabel: variant?.label,
      personalization: product.personalizable
        ? { names, date, monogram, technique: technique?.technique }
        : undefined,
    });
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 2000);
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-10 grid md:grid-cols-2 gap-12">
      <div>
        <div className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-cream mb-4">
          {displayImage && <Image src={displayImage} alt={product.name} fill className="object-cover" priority />}
          {product.personalizable && zone && showOverlayHere && (
            <div
              ref={zoneRef}
              className="absolute pointer-events-none flex flex-col items-center justify-center rounded-2xl bg-terracotta/90 border-2 border-dashed border-cream-light/60 text-cream-light text-center px-3 shadow-xl overflow-hidden"
              style={{
                left: `${zone.pos_x_pct}%`,
                top: `${zone.pos_y_pct}%`,
                width: `${zone.width_pct}%`,
                height: `${zone.height_pct}%`,
              }}
            >
              <span style={{ fontSize: monogramFontPx }} className="mb-1">
                {monogram}
              </span>
              <span
                style={{ fontSize: nameFontPx }}
                className="font-serif leading-tight line-clamp-2"
              >
                {names || "Your names"}
              </span>
              <span style={{ fontSize: dateFontPx }} className="mt-1 tracking-wide">
                {formattedDate}
              </span>
            </div>
          )}
          <span className="absolute bottom-3 left-3 text-[11px] bg-cream-light/90 px-3 py-1 rounded-full flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-sage" /> Live preview
          </span>
        </div>
        {product.images.length > 1 && (
          <div className="flex gap-3">
            {product.images.map((img, i) => (
              <button
                key={img.id}
                onClick={() => setActiveImage(i)}
                className={`relative h-16 w-16 rounded-lg overflow-hidden border ${
                  i === activeImage ? "border-dark" : "border-line"
                }`}
              >
                <Image src={img.url} alt="" fill className="object-cover" />
                {zone?.image_id === img.id && (
                  <span className="absolute bottom-0.5 right-0.5 h-2 w-2 rounded-full bg-terracotta" />
                )}
              </button>
            ))}
          </div>
        )}

        {zone && (
          <div className="mt-6 rounded-xl bg-cream p-6 text-sm text-muted space-y-1">
            <p className="text-xs uppercase tracking-wide text-dark mb-2">Print area</p>
            <p>
              Printable zone {zone.width_mm}×{zone.height_mm}mm
              {technique ? ` · ${technique.technique}` : ""}
            </p>
            <p>Max {zone.max_chars_per_line ?? "—"} characters per line</p>
          </div>
        )}
      </div>

      <div>
        <p className="text-xs uppercase tracking-[0.15em] text-terracotta mb-2">
          {product.categoryName} · {product.supplierName}
        </p>
        <h1 className="font-serif text-4xl mb-3">{product.name}</h1>
        <p className="text-2xl mb-1">
          {formatUSD(unitPriceWithTechnique)}{" "}
          <span className="text-sm text-muted font-normal">
            per piece · min {product.minOrder}
          </span>
        </p>
        <p className="text-muted mb-8">{product.description}</p>

        {product.variants.length > 0 && (
          <div className="mb-8">
            <label className="text-xs uppercase tracking-wide text-muted block mb-2">
              {product.variants[0]?.sku ? "Option" : "Variant"}
            </label>
            <div className="flex flex-wrap gap-2">
              {product.variants.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setVariantId(v.id)}
                  className={`px-4 py-2 rounded-lg text-sm border text-left ${
                    variantId === v.id ? "border-dark bg-cream" : "border-line"
                  }`}
                >
                  <span className="block font-medium">{v.label}</span>
                  {v.price_delta !== 0 && (
                    <span className="text-xs text-muted">
                      {v.price_delta > 0 ? "+" : ""}
                      {formatUSD(applyMarkup(v.price_delta, product.markupPct))}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {product.personalizable && (
          <div className="space-y-6 mb-8">
            <div>
              <label className="text-xs uppercase tracking-wide text-muted block mb-2">
                Your names or event text
              </label>
              <input
                value={names}
                onChange={(e) => setNames(e.target.value.slice(0, zone?.max_chars_per_line ?? 24))}
                className="w-full rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark"
              />
            </div>
            <div>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-muted block mb-2">Monogram</label>
              <div className="flex gap-2 flex-wrap">
                {MONOGRAMS.map((m) => (
                  <button
                    key={m}
                    onClick={() => setMonogram(m)}
                    className={`h-11 w-11 rounded-lg border flex items-center justify-center text-lg ${
                      monogram === m ? "border-dark bg-dark text-cream-light" : "border-line"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {product.techniques.length > 0 && (
          <div className="mb-8">
            <label className="text-xs uppercase tracking-wide text-muted block mb-2">
              Print technique
            </label>
            <div className="grid grid-cols-3 gap-2">
              {product.techniques.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTechniqueId(t.id)}
                  className={`rounded-lg border px-3 py-3 text-sm text-left ${
                    techniqueId === t.id ? "border-dark bg-cream" : "border-line"
                  }`}
                >
                  <span className="block font-medium">{t.technique}</span>
                  <span className="text-xs text-muted">
                    {t.extra_price > 0 ? `+${formatUSD(t.extra_price)}` : "Included"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {product.personalizable && (
          <AiRenderPanel productId={product.id} names={names} date={date} monogram={monogram} />
        )}

        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs uppercase tracking-wide text-muted">Quantity</label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setQuantity((q) => Math.max(product.minOrder, q - product.minOrder))}
                className="h-8 w-8 rounded-full border border-line flex items-center justify-center"
              >
                −
              </button>
              <span className="w-10 text-center font-medium">{quantity}</span>
              <button
                onClick={() => setQuantity((q) => q + product.minOrder)}
                className="h-8 w-8 rounded-full border border-line flex items-center justify-center"
              >
                +
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            {quickQuantities.map((q) => (
              <button
                key={q}
                onClick={() => setQuantity(q)}
                className={`px-4 py-2 rounded-full text-sm border ${
                  quantity === q ? "bg-dark text-cream-light border-dark" : "border-line"
                }`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl bg-cream p-6 flex items-center justify-between gap-4">
          <div>
            <p className="font-serif text-3xl">{formatUSD(total)}</p>
            <p className="text-xs text-muted">
              {quantity} × {formatUSD(unitPriceWithTechnique)} · proof in 48h
            </p>
          </div>
          <button
            onClick={handleAddToCart}
            className="px-6 py-3 rounded-full bg-terracotta text-cream-light text-sm font-medium hover:bg-terracotta-dark transition-colors shrink-0"
          >
            {justAdded ? "Added ✓" : "Add to Cart"}
          </button>
        </div>
        <button
          onClick={() => router.push(`/store/${product.plannerSlug}/cart`)}
          className="text-sm text-muted mt-4 hover:text-terracotta"
        >
          View cart →
        </button>
      </div>
    </div>
  );
}
