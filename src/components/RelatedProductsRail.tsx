"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatUSD } from "@/lib/format";
import { monogramSvgInner } from "@/lib/monograms";
import { savePersonalizationHandoff } from "@/lib/personalizationHandoff";
import { useCart } from "@/lib/cart";
import type { RelatedProduct } from "@/lib/queries";

// The bounding box of a product's print-area quad, matching the same
// helper used in ProductConfigurator — kept small and local here since this
// card doesn't need the rest of that file's drag/resize machinery.
function boundingBox(corners: { x: number; y: number }[]) {
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  return { left, top, width: Math.max(...xs) - left, height: Math.max(...ys) - top };
}

// A square preview card doesn't need the px-per-percent correction the
// full configurator applies for its non-square container — in a square
// box, the raw percentage-space angle between the zone's corners already
// matches the on-screen angle, so this is a plain atan2 over corners_pct.
function zoneAngleDeg(corners: { x: number; y: number }[]) {
  if (corners.length !== 4) return 0;
  const [tl, tr] = corners;
  return (Math.atan2(tr.y - tl.y, tr.x - tl.x) * 180) / Math.PI;
}

function formatDate(isoDate: string) {
  if (!isoDate) return "";
  const d = new Date(isoDate + "T00:00:00");
  if (Number.isNaN(d.getTime())) return isoDate;
  return d
    .toLocaleDateString("en-US", { day: "2-digit", month: "2-digit", year: "numeric" })
    .replace(/\//g, "·");
}

function RelatedProductCard({
  product,
  base,
  names,
  date,
  monogram,
  logoDataUrl,
}: {
  product: RelatedProduct;
  base: string;
  names: string;
  date: string;
  monogram: string;
  logoDataUrl: string | null;
}) {
  const router = useRouter();
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  const zoneBox = product.zone && product.zone.corners_pct.length === 4 ? boundingBox(product.zone.corners_pct) : null;
  const rotation = product.zone ? zoneAngleDeg(product.zone.corners_pct) : 0;
  const hasPersonalization = !!(names.trim() || date.trim() || monogram || logoDataUrl);

  const handleClick = (e: React.MouseEvent) => {
    if (hasPersonalization) {
      savePersonalizationHandoff({ names, date, monogram, logoDataUrl });
    }
    e.preventDefault();
    router.push(`${base}/shop/${product.slug}`);
  };

  // Adds with the same personalization already shown on the card (what you
  // see is what gets added) at the product's minimum order — a quick cross-
  // sell add without leaving this page. Anything more specific (a different
  // technique, quantity, or variant) still means visiting the product page.
  const handleQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addItem({
      key: `${product.id}:quick-add`,
      productId: product.id,
      slug: product.slug,
      name: product.name,
      image: product.image,
      unitPrice: product.price,
      quantity: product.minOrder,
      minOrder: product.minOrder,
      personalization:
        product.personalizable && hasPersonalization
          ? { names, date, monogram, hasLogo: !!logoDataUrl }
          : undefined,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <Link
      href={`${base}/shop/${product.slug}`}
      onClick={handleClick}
      className="w-52 shrink-0 group"
    >
      <div className="relative aspect-square rounded-xl overflow-hidden bg-cream mb-2">
        {product.image && (
          <Image
            src={product.image}
            alt={product.name}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-110"
          />
        )}
        {product.personalizable && zoneBox && hasPersonalization && (
          <div
            className="absolute text-center pointer-events-none"
            style={{
              left: `${zoneBox.left}%`,
              top: `${zoneBox.top}%`,
              width: `${zoneBox.width}%`,
              height: `${zoneBox.height}%`,
            }}
          >
            <div
              className="absolute left-1/2 top-1/2 flex flex-col items-center gap-0.5"
              style={{ transform: `translate(-50%, -50%) rotate(${rotation}deg)` }}
            >
              {logoDataUrl && (
                <div className="relative h-6 w-6">
                  <Image src={logoDataUrl} alt="" fill className="object-contain" unoptimized />
                </div>
              )}
              {monogram && (
                <svg
                  viewBox="0 0 24 24"
                  width={15}
                  height={15}
                  dangerouslySetInnerHTML={{ __html: monogramSvgInner(monogram, product.inkColor) }}
                />
              )}
              {names && (
                <span className="font-serif whitespace-nowrap leading-none" style={{ fontSize: 10, color: product.inkColor }}>
                  {names}
                </span>
              )}
              {date && (
                <span className="whitespace-nowrap leading-none" style={{ fontSize: 7, color: product.inkColor }}>
                  {formatDate(date)}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
      <p className="text-sm font-medium truncate group-hover:text-terracotta transition-colors">{product.name}</p>
      <div className="flex items-center justify-between gap-2 mt-0.5">
        <p className="text-xs text-muted">From {formatUSD(product.price)}</p>
        <button
          type="button"
          onClick={handleQuickAdd}
          className="text-xs uppercase tracking-wide font-medium text-terracotta hover:text-terracotta-dark shrink-0"
        >
          {added ? "Added ✓" : "+ Add"}
        </button>
      </div>
    </Link>
  );
}

export function RelatedProductsRail({
  products,
  base,
  names,
  date,
  monogram,
  logoDataUrl,
}: {
  products: RelatedProduct[];
  base: string;
  names: string;
  date: string;
  monogram: string;
  logoDataUrl: string | null;
}) {
  if (products.length === 0) return null;

  return (
    <div className="mt-12 border-t border-line pt-8">
      <p className="text-xs uppercase tracking-wide text-muted mb-4">Goes well with</p>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {products.map((p) => (
          <RelatedProductCard
            key={p.id}
            product={p}
            base={base}
            names={names}
            date={date}
            monogram={monogram}
            logoDataUrl={logoDataUrl}
          />
        ))}
      </div>
    </div>
  );
}
