"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { formatUSD } from "@/lib/format";
import { useCart } from "@/lib/cart";

const MONOGRAMS = ["✦", "❀", "❖", "⬥", "✿", "☙"];

type Technique = { id: string; technique: string; extra_price: number; is_default: boolean };
type Zone = { id: string; label: string; max_chars_per_line: number | null; width_mm: number | null; height_mm: number | null };

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
    unitPrice: number;
    minOrder: number;
    leadTimeMin: number;
    leadTimeMax: number;
    personalizable: boolean;
    images: string[];
    techniques: Technique[];
    zones: Zone[];
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
  const [quantity, setQuantity] = useState(product.minOrder);
  const [activeImage, setActiveImage] = useState(0);
  const [justAdded, setJustAdded] = useState(false);

  const technique = product.techniques.find((t) => t.id === techniqueId);
  const zone = product.zones[0];

  const unitPriceWithTechnique = product.unitPrice + (technique?.extra_price ?? 0);
  const total = unitPriceWithTechnique * quantity;

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
      key: `${product.id}:${names}:${date}:${monogram}:${techniqueId}`,
      productId: product.id,
      slug: product.slug,
      name: product.name,
      image: product.images[0] ?? null,
      unitPrice: unitPriceWithTechnique,
      quantity,
      minOrder: product.minOrder,
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
          {product.images[activeImage] && (
            <Image
              src={product.images[activeImage]}
              alt={product.name}
              fill
              className="object-cover"
              priority
            />
          )}
          {product.personalizable && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-56 h-56 rounded-full bg-terracotta/90 border-2 border-dashed border-cream-light/60 flex flex-col items-center justify-center text-cream-light text-center px-6 shadow-xl">
                <span className="text-xl mb-2">{monogram}</span>
                <span className="font-serif text-lg leading-tight">{names || "Your names"}</span>
                <span className="text-xs mt-2 tracking-wide">{formattedDate}</span>
              </div>
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
                key={img + i}
                onClick={() => setActiveImage(i)}
                className={`relative h-16 w-16 rounded-lg overflow-hidden border ${
                  i === activeImage ? "border-dark" : "border-line"
                }`}
              >
                <Image src={img} alt="" fill className="object-cover" />
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
            <p>
              Max {zone.max_chars_per_line ?? "—"} characters per line
            </p>
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
