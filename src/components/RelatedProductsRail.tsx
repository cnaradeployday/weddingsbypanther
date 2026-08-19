"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatUSD } from "@/lib/format";
import { monogramSvgInner } from "@/lib/monograms";
import { frameSvgInner } from "@/lib/frameTemplates";
import { textFontStyle } from "@/lib/textFonts";
import { fitTextFontSize } from "@/lib/textFit";
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

const clamp = (min: number, value: number, max: number) => Math.max(min, Math.min(max, value));

// Matches the card's fixed Tailwind width (w-52 = 13rem = 208px at the
// default root font size) — there's no ResizeObserver here like the full
// configurator has, but the card's size is a fixed class, not something
// that varies at runtime, so a constant is exact rather than approximate.
const CARD_PX = 208;

function RelatedProductCard({
  product,
  base,
  names,
  date,
  monogram,
  logoDataUrl,
  frame,
  textFont,
  elemScale,
  quantity,
}: {
  product: RelatedProduct;
  base: string;
  names: string;
  date: string;
  monogram: string;
  logoDataUrl: string | null;
  frame: string;
  textFont: string;
  elemScale: Record<string, number>;
  quantity: number;
}) {
  const router = useRouter();
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  const zoneBox = product.zone && product.zone.corners_pct.length === 4 ? boundingBox(product.zone.corners_pct) : null;
  const rotation = product.zone ? zoneAngleDeg(product.zone.corners_pct) : 0;
  const hasPersonalization = !!(names.trim() || date.trim() || monogram || logoDataUrl);

  // The same relative scale the customer set on the main product (a resize
  // handle multiplier, not an absolute size) carries over here so the
  // preview reads as "this, but on that product" rather than a fixed
  // one-size-fits-all overlay. A raw clamp on the multiplier alone isn't
  // enough for text, though — a long name at even a modest scale can still
  // run past this much smaller card's edge, the same overflow bug fixed on
  // the main preview — so names/date are additionally fit to the print
  // zone's actual width on this card, exactly like the full configurator
  // does, not just capped to a fixed font-size range.
  const availableWidthPx = (zoneBox ? (zoneBox.width / 100) * CARD_PX : CARD_PX) * 0.92;
  const nameSize = fitTextFontSize(names, clamp(7, 11 * (elemScale.names ?? 1), 22), availableWidthPx);
  const dateSize = fitTextFontSize(formatDate(date), clamp(5, 7 * (elemScale.date ?? 1), 14), availableWidthPx);
  const monogramSize = clamp(10, 16 * (elemScale.monogram ?? 1), 28);
  const logoSize = clamp(16, 26 * (elemScale.logo ?? 1), 44);

  const handleClick = (e: React.MouseEvent) => {
    if (hasPersonalization) {
      savePersonalizationHandoff({ names, date, monogram, logoDataUrl, frame, textFont, elemScale });
    }
    e.preventDefault();
    router.push(`${base}/shop/${product.slug}`);
  };

  // Adds with the same personalization and quantity already set on the main
  // product (what you see is what gets added) — a quick cross-sell add
  // without leaving this page. Anything more specific (a different
  // technique or variant) still means visiting the product page.
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
      quantity: Math.max(product.minOrder, quantity),
      minOrder: product.minOrder,
      personalization:
        product.personalizable && hasPersonalization
          ? { names, date, monogram, frame, textFont, hasLogo: !!logoDataUrl }
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
              className="absolute left-1/2 top-1/2 flex flex-col items-center gap-1"
              style={{ transform: `translate(-50%, -50%) rotate(${rotation}deg)` }}
            >
              {logoDataUrl && (
                <div className="relative" style={{ width: logoSize, height: logoSize }}>
                  <Image src={logoDataUrl} alt="" fill className="object-contain" unoptimized />
                </div>
              )}
              {monogram && (
                <svg
                  viewBox="0 0 24 24"
                  width={monogramSize}
                  height={monogramSize}
                  dangerouslySetInnerHTML={{ __html: monogramSvgInner(monogram, product.inkColor) }}
                />
              )}
              {names && (
                <div className="relative" style={{ fontSize: nameSize }}>
                  {frame && (
                    <svg
                      viewBox="0 0 200 90"
                      preserveAspectRatio="none"
                      className="absolute pointer-events-none"
                      style={{
                        inset: `${-nameSize * 0.45}px ${-nameSize * 0.7}px`,
                        width: `calc(100% + ${nameSize * 1.4}px)`,
                        height: `calc(100% + ${nameSize * 0.9}px)`,
                      }}
                      dangerouslySetInnerHTML={{ __html: frameSvgInner(frame, product.inkColor) }}
                    />
                  )}
                  <span
                    className="relative block whitespace-nowrap leading-none"
                    style={{ color: product.inkColor, ...textFontStyle(textFont) }}
                  >
                    {names}
                  </span>
                </div>
              )}
              {date && (
                <span
                  className="whitespace-nowrap leading-none"
                  style={{ fontSize: dateSize, color: product.inkColor }}
                >
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
  frame,
  textFont,
  elemScale,
  quantity,
}: {
  products: RelatedProduct[];
  base: string;
  names: string;
  date: string;
  monogram: string;
  logoDataUrl: string | null;
  frame: string;
  textFont: string;
  elemScale: Record<string, number>;
  quantity: number;
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
            frame={frame}
            textFont={textFont}
            elemScale={elemScale}
            quantity={quantity}
          />
        ))}
      </div>
    </div>
  );
}
