"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { formatUSD } from "@/lib/format";
import { applyMarkup } from "@/lib/format";
import { useCart, type AreaPersonalization } from "@/lib/cart";
import { createClient } from "@/lib/supabase/client";
import { techniqueInkColor } from "@/lib/printTechniqueColors";
import { MONOGRAM_OPTIONS, monogramSvgInner } from "@/lib/monograms";
import { FRAME_TEMPLATES, frameSvgInner } from "@/lib/frameTemplates";
import { TEXT_FONTS, DEFAULT_TEXT_FONT, textFontStyle } from "@/lib/textFonts";
import { fitTextFontSize, estimateTextWidth, textLineCount } from "@/lib/textFit";
import { consumePersonalizationHandoff } from "@/lib/personalizationHandoff";
import { isNamesValid, NAMES_REQUIRED_MESSAGE } from "@/lib/personalizationValidation";
import { computeDefaultPositions } from "@/lib/defaultDesignLayout";
import { designStorage, LATEST_VERSION_ID } from "@/lib/designStorage";
import { formatPrintDate } from "@/lib/printDate";
import { parseQuantityInput, isQuantityBelowMinimum } from "@/lib/quantityValidation";
import { dataUrlToBlob } from "@/lib/dataUrl";
import { recolorLogoToSolid, removeLogoBackground } from "@/lib/logoRecolor";
import { detectLogoColors, type DetectedColor } from "@/lib/logoColors";
import { estimatePrintDpi, MIN_PRINT_DPI } from "@/lib/logoPrintQuality";
import { nearestPantone, resolveColorInput } from "@/lib/pantoneMatch";
import { leadTimeRange } from "@/lib/leadTime";
import type { BusinessType } from "@/lib/businessType";
import {
  availableAlongAxis,
  clampOrientedBoxToQuad,
  maxOrientedBoxScale,
  resolveRotatedContainment,
  type Point,
} from "@/lib/quadGeometry";
import type { RelatedProduct } from "@/lib/queries";
import { AiRenderPanel } from "./AiRenderPanel";
import { RelatedProductsRail } from "./RelatedProductsRail";
import { QuoteRequestForm } from "./QuoteRequestForm";

// Approximates how each print technique looks on the manual (non-AI) live
// preview — a plain color swap for printed techniques, plus a debossed
// highlight/shadow pairing for engrave so it reads as cut into the material
// rather than printed on top of it.
// Flat ink color per technique, no drop-shadow/bevel tricks — those read as
// a stray white smudge/halo behind the text more often than they read as
// "engraved," so the manual preview keeps it simple and lets color alone
// carry the technique's look.
function techniqueTextStyle(techniqueName?: string, colorOverride?: string): React.CSSProperties {
  const color = colorOverride ?? techniqueInkColor(techniqueName);
  const fontWeight = techniqueName === "Laser engrave" || techniqueName === "Foil stamp" ? 500 : techniqueName === "Embroidery" ? 600 : undefined;
  return fontWeight ? { color, fontWeight } : { color };
}

type Technique = {
  id: string;
  technique: string;
  extra_price: number;
  is_default: boolean;
  stripSourceColor?: boolean;
  singleColorInk?: boolean;
  singleColorFillMode?: "silhouette" | "reference";
};
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
  max_lines: number | null;
  width_mm: number | null;
  height_mm: number | null;
  corners_pct: { x: number; y: number }[];
  image_id: string | null;
  extra_price: number;
};

// The live CSS preview shows the bounding box of the (possibly angled/
// trapezoidal) print area rather than attempting a true perspective warp —
// the AI render is what shows the accurate, perspective-correct result.
function boundingBox(corners: { x: number; y: number }[]) {
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  return { left, top, width: Math.max(...xs) - left, height: Math.max(...ys) - top };
}

type ElemKey = "logo" | "monogram" | "names" | "date";
type ElemPos = { x: number; y: number };

// Everything about a print area's personalization that's specific to that
// one area — a shopper who adds a secondary/tertiary area gets a fresh,
// independent design for it rather than reusing whatever's on the primary
// area, since the two areas usually differ in size/shape and often call for
// a different logo entirely. Kept out of the DB row shape (Zone) itself:
// this is only ever in-memory, on-page state, snapshotted per zone id while
// the shopper switches between areas.
type ZoneDesign = {
  names: string;
  date: string;
  monogram: string;
  frame: string;
  textFont: string;
  logoFile: File | null;
  logoPreview: string | null;
  inkColor: string;
  colorTextInput: string;
  positions: Record<ElemKey, ElemPos>;
  elemScale: Record<ElemKey, number>;
  elemRotationOffset: Record<ElemKey, number>;
  elemOrder: ElemKey[];
};

// Direct-manipulation resize/rotate handles shared by all four
// personalization elements: drag the corner icon to scale (uniformly,
// never distorting), drag the icon above to rotate, both in place on the
// element itself. Only rendered while that element is the selected one
// (tapped on), so the photo stays clean otherwise.
function ResizeIcon() {
  return (
    <svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 13 L13 3" />
      <path d="M8.5 3 H13 V7.5" />
      <path d="M7.5 13 H3 V8.5" />
    </svg>
  );
}

function RotateIcon() {
  return (
    <svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 8a5 5 0 1 1-1.7-3.75" />
      <path d="M13 2.2v3.6H9.4" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="10"
      height="10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path d="M3 5.5 L8 10.5 L13 5.5" />
    </svg>
  );
}

// Each personalization option (logo, frame, names, date, monogram) starts
// collapsed to just its title so the page doesn't load with every option's
// full controls open at once — a big source of scroll length on the product
// page. Tap the title to expand and edit, tap again to collapse.
function CollapsibleSection({
  title,
  optional,
  trailing,
  defaultOpen = false,
  children,
}: {
  title: string;
  optional?: boolean;
  trailing?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 mb-2"
      >
        <span className="text-xs uppercase tracking-wide text-muted">
          {title} {optional && <span className="normal-case text-muted/70">(optional)</span>}
        </span>
        <span className="flex items-center gap-2 text-muted shrink-0">
          {trailing}
          <ChevronIcon open={open} />
        </span>
      </button>
      {open && children}
    </div>
  );
}

// A handle at each of the 4 corners (not just one) — resize is a uniform
// scale from the element's own center regardless of which corner drives it,
// so every corner behaves identically. With several personalization
// elements able to overlap, having 4 grab points instead of 1 makes it much
// more likely at least one is clear of whatever else is on top of it. The
// dashed outline traces the element's own box so it's unambiguous which
// element is currently selected once a few of them overlap.
function AdjustHandles({
  onResizeStart,
  onRotateStart,
  notice,
  expandBy,
}: {
  onResizeStart: (e: React.PointerEvent) => void;
  onRotateStart: (e: React.PointerEvent) => void;
  // Brief feedback shown at the print-area limit — BUG-10 (resize) and
  // BUG-03 (a rotation that had to shrink the element to fit).
  notice?: string;
  // BUG-04: a decorative frame draws further out than the text element it's
  // wrapped around (a negative-inset sibling, see the "names" element
  // below) — without this, the dashed selection outline and handles traced
  // only the plain text's box, leaving the visible frame sticking out past
  // them. In px, how far the frame extends beyond the element on each axis;
  // omitted (or {x:0,y:0}) for an element with no frame.
  expandBy?: { x: number; y: number };
}) {
  const expandX = expandBy?.x ?? 0;
  const expandY = expandBy?.y ?? 0;
  const corner =
    "absolute h-5 w-5 flex items-center justify-center rounded-full bg-white border-2 border-terracotta text-terracotta-dark cursor-nwse-resize touch-none pointer-events-auto";
  // The handles' resting offset with no frame (matches the original fixed
  // -2.5 / -top-8 Tailwind spacing), pushed further out by the frame's own
  // extra footprint when there is one.
  const cornerOffset = 10 + expandX;
  const cornerOffsetY = 10 + expandY;
  const rotateOffset = 32 + expandY;
  return (
    <>
      <div
        className="absolute rounded-sm border border-dashed border-terracotta pointer-events-none"
        style={{ inset: `${-expandY}px ${-expandX}px` }}
      />
      <div
        onPointerDown={onResizeStart}
        className={corner}
        style={{ left: -cornerOffset, top: -cornerOffsetY }}
      >
        <ResizeIcon />
      </div>
      <div
        onPointerDown={onResizeStart}
        className={corner}
        style={{ right: -cornerOffset, top: -cornerOffsetY }}
      >
        <ResizeIcon />
      </div>
      <div
        onPointerDown={onResizeStart}
        className={corner}
        style={{ left: -cornerOffset, bottom: -cornerOffsetY }}
      >
        <ResizeIcon />
      </div>
      <div
        onPointerDown={onResizeStart}
        className={corner}
        style={{ right: -cornerOffset, bottom: -cornerOffsetY }}
      >
        <ResizeIcon />
      </div>
      <div
        onPointerDown={onRotateStart}
        className="absolute left-1/2 h-5 w-5 -translate-x-1/2 flex items-center justify-center rounded-full bg-white border-2 border-terracotta text-terracotta-dark cursor-grab touch-none pointer-events-auto"
        style={{ top: -rotateOffset }}
      >
        <RotateIcon />
      </div>
      {notice && (
        <span
          role="status"
          className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-dark text-cream-light text-[11px] px-2.5 py-1 pointer-events-none"
          style={{ top: -rotateOffset - 32 }}
        >
          {notice}
        </span>
      )}
    </>
  );
}

// Flat USD fee for a one-off sample order — covers the machine setup for
// printing just one piece, on top of the usual unit price and shipping.
const SAMPLE_FEE = 50;

const DEFAULT_SCALES: Record<ElemKey, number> = { logo: 1, monogram: 1, names: 1, date: 1 };
const DEFAULT_ROTATIONS: Record<ElemKey, number> = { logo: 0, monogram: 0, names: 0, date: 0 };

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Measures the rendered zone box so text/logo sizing can be derived from the
// product's real print-area dimensions (mm), not a guessed fixed size.
//
// BUG-05: this used to attach the ResizeObserver once, in a mount-only
// effect, to whatever DOM node the ref pointed at that first time. The zone
// box unmounts and remounts every time the shopper views a photo that isn't
// this zone's own reference image (see `showOverlayHere`) — a fresh DOM node
// each time — so that one-time observer was left watching a detached node
// forever after the first switch, freezing the measured size (and
// everything derived from it: font sizes, the cm labels) at whatever it
// happened to be right before that first unmount. A callback ref instead
// re-attaches a fresh observer on every mount, including remounts.
function useElementSize<T extends HTMLElement>() {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const observerRef = useRef<ResizeObserver | null>(null);

  const ref = useCallback((el: T | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(el);
    observerRef.current = observer;
  }, []);

  return [ref, size] as const;
}

export function ProductConfigurator({
  product,
  unlimitedRenders = false,
  relatedProducts = [],
}: {
  unlimitedRenders?: boolean;
  relatedProducts?: RelatedProduct[];
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
    popularQty: number | null;
    allowSample: boolean;
    leadTimeMin: number;
    leadTimeMax: number;
    personalizable: boolean;
    images: ProductImage[];
    techniques: Technique[];
    zones: Zone[];
    variants: Variant[];
    plannerSlug: string;
    plannerId: string;
    businessType: BusinessType;
    aiRenderEnabled: boolean;
  };
}) {
  const router = useRouter();
  const { addItem } = useCart();
  const isMerchandise = product.businessType === "merchandise";

  // If the customer arrived here by tapping a suggested product on another
  // product's page, pick up the names/date/monogram/logo they'd already
  // entered there instead of starting blank — read once, synchronously, as
  // the initial state itself (not an effect) since sessionStorage is a
  // one-shot read, not a subscription. Cleared as soon as it's read, so it
  // only ever applies right after that click, not on a later unrelated visit.
  const [handoff] = useState(() => consumePersonalizationHandoff());
  // Placeholder content only — a starting point so the live preview isn't
  // blank, swapped out per vertical so a promotional-merchandise storefront
  // doesn't open on a wedding couple's names.
  const [names, setNames] = useState(handoff?.names || (isMerchandise ? "Your Company" : "Amelia & Ravi"));
  const [date, setDate] = useState(handoff?.date || (isMerchandise ? "" : "2026-06-14"));
  const [monogram, setMonogram] = useState(handoff?.monogram || "");
  const [frame, setFrame] = useState(handoff?.frame || "");
  const [textFont, setTextFont] = useState<string>(
    handoff?.textFont || (isMerchandise ? "montserrat" : DEFAULT_TEXT_FONT)
  );
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(handoff?.logoDataUrl ?? null);
  // Only meaningful for a single-color-ink technique: the ink color the
  // customer picks for their logo, the resulting flattened silhouette
  // preview (fill-mode "silhouette"), and the logo traced into vector path
  // data so the print-ready outline can include it as true curves.
  const [inkColor, setInkColor] = useState("#1a1a1a");
  const [colorTextInput, setColorTextInput] = useState("");
  const [logoSilhouetteUrl, setLogoSilhouetteUrl] = useState<string | null>(null);
  const [logoVector, setLogoVector] = useState<{ ds: string[]; width: number; height: number } | null>(null);
  const [removingBackground, setRemovingBackground] = useState(false);
  const [logoNaturalSize, setLogoNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [detectedColors, setDetectedColors] = useState<DetectedColor[]>([]);

  // The handoff logo is only a data URL (its File object couldn't survive
  // navigation) — reconstitute it as a real File async so it can still be
  // uploaded on checkout, same as one the customer picked here directly.
  useEffect(() => {
    if (!handoff?.logoDataUrl) return;
    dataUrlToBlob(handoff.logoDataUrl).then((blob) => {
      setLogoFile(new File([blob], "logo.png", { type: blob.type || "image/png" }));
    });
  }, [handoff]);
  // A cart-item "Edit" click carries the exact positions/rotations that
  // were configured back through the handoff (a plain related-product
  // suggestion click has no prior arrangement, so these are absent there
  // and fall back to the defaults as usual).
  const [positions, setPositions] = useState<Record<ElemKey, ElemPos>>(() => {
    const defaults = computeDefaultPositions(product.zones[0]);
    return handoff?.positions ? { ...defaults, ...handoff.positions } : defaults;
  });
  // Each element (logo, monogram, names, date) gets its own independent
  // size and rotation, adjusted with on-canvas drag handles right on the
  // element — not shared sliders elsewhere in the page.
  const [elemScale, setElemScale] = useState<Record<ElemKey, number>>(
    handoff?.elemScale ? { ...DEFAULT_SCALES, ...handoff.elemScale } : DEFAULT_SCALES
  );
  const [elemRotationOffset, setElemRotationOffset] = useState<Record<ElemKey, number>>(
    handoff?.elemRotationOffset ? { ...DEFAULT_ROTATIONS, ...handoff.elemRotationOffset } : DEFAULT_ROTATIONS
  );
  // Resize/rotate handles only show on the element the customer tapped —
  // otherwise the photo stays uncluttered.
  const [activeElem, setActiveElem] = useState<ElemKey | null>(null);
  // Brief, non-blocking feedback shown near an element's size tag while
  // resizing hits the print area's limit (BUG-10) or a rotation had to
  // shrink the element to keep it inside the print area (BUG-03) — cleared
  // as soon as the gesture ends.
  const [elemNotice, setElemNotice] = useState<{ key: ElemKey; message: string } | null>(null);
  // Whichever element was tapped most recently renders on top of the
  // others — without this, overlapping elements always hit-test in a fixed
  // DOM order (logo, then monogram, then names, then date), so a later
  // element's invisible box can steal clicks meant for one drawn earlier
  // even where the later element has no visible pixels there.
  const [elemOrder, setElemOrder] = useState<ElemKey[]>(["logo", "monogram", "names", "date"]);
  const bringToFront = useCallback((key: ElemKey) => {
    setElemOrder((prev) => (prev[prev.length - 1] === key ? prev : [...prev.filter((k) => k !== key), key]));
  }, []);
  const dragState = useRef<{
    key: ElemKey;
    startX: number;
    startY: number;
    originPx: Point;
    halfW: number;
    halfH: number;
    rotationRad: number;
  } | null>(null);
  const elemAdjustState = useRef<{
    key: ElemKey;
    mode: "resize" | "rotate";
    centerX: number;
    centerY: number;
    startDist: number;
    startAngle: number;
    startScale: number;
    startRotation: number;
    maxScale: number;
    // Only used by the rotate branch (BUG-03): the element's own true
    // (unrotated) footprint and photo-local center, the quad it must stay
    // inside, and the print area's own auto-tilt at gesture start — enough
    // to re-run containment against the *new* rotation on every move event,
    // without needing anything from component scope that could go stale
    // mid-gesture.
    quadCornersPx: Point[] | null;
    centerPhotoPx: Point | null;
    naturalHalfW: number;
    naturalHalfH: number;
    autoRotationDeg: number;
  } | null>(null);
  const [techniqueId, setTechniqueId] = useState(
    product.techniques.find((t) => t.is_default)?.id ?? product.techniques[0]?.id ?? ""
  );
  const [variantId, setVariantId] = useState(product.variants[0]?.id ?? "");
  const [quantity, setQuantity] = useState(
    product.popularQty && product.popularQty >= product.minOrder ? product.popularQty : product.minOrder
  );
  // The quantity field is directly editable (not just +/-/preset chips) so
  // a customer can type an exact amount — kept as its own string state so
  // typing isn't clobbered by clamping mid-keystroke; every other way of
  // changing quantity (the +/- buttons, the preset chips) updates this
  // alongside `quantity` via updateQuantity below, rather than syncing it
  // from an effect.
  const [quantityInput, setQuantityInput] = useState(String(quantity));
  const updateQuantity = (next: number) => {
    setQuantity(next);
    setQuantityInput(String(next));
  };
  // BUG-09: typing a value below the minimum (or an invalid one) no longer
  // silently snaps to the minimum on blur — it stays exactly as typed, with
  // an inline message and the cart buttons disabled, until corrected. The
  // committed `quantity` (used for the total and Add to Cart) only advances
  // once the typed value is actually valid.
  const parsedQuantityInput = parseQuantityInput(quantityInput);
  const quantityBelowMinimum = isQuantityBelowMinimum(quantityInput, product.minOrder);
  const commitQuantityInput = () => {
    if (parsedQuantityInput !== null && parsedQuantityInput >= product.minOrder) {
      updateQuantity(parsedQuantityInput);
    }
  };
  const [justAdded, setJustAdded] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  const [sampleAdded, setSampleAdded] = useState(false);
  const [addingSample, setAddingSample] = useState(false);
  const [latestRender, setLatestRender] = useState<{
    imageDataUrl: string;
    contextImageDataUrl: string | null;
    zoneId: string;
  } | null>(null);

  const primaryZone = product.zones[0];
  // Which print area the shopper is currently viewing/personalizing. The
  // primary area is always included in the order; secondary/tertiary ones
  // (selectedExtraZoneIds) are additive add-ons the shopper opts into, each
  // with its own surcharge and its own independent design (see ZoneDesign
  // above) — switching areas doesn't discard what was configured elsewhere.
  const [activeZoneId, setActiveZoneId] = useState(primaryZone?.id ?? "");
  const [selectedExtraZoneIds, setSelectedExtraZoneIds] = useState<Set<string>>(new Set());
  const zoneDesignsRef = useRef<Record<string, ZoneDesign>>({});
  const zone = product.zones.find((z) => z.id === activeZoneId) ?? primaryZone;
  const zoneImageIndex = zone?.image_id ? product.images.findIndex((i) => i.id === zone.image_id) : -1;
  const [activeImage, setActiveImage] = useState(zoneImageIndex >= 0 ? zoneImageIndex : 0);

  // Fresh, unconfigured design for a print area the shopper hasn't visited
  // yet — same placeholder/default values the component itself starts with,
  // minus the cross-page handoff (that only ever applies to the area the
  // shopper actually landed on).
  const makeDefaultDesign = useCallback(
    (zoneForDefaults?: Zone): ZoneDesign => ({
      names: isMerchandise ? "Your Company" : "Amelia & Ravi",
      date: isMerchandise ? "" : "2026-06-14",
      monogram: "",
      frame: "",
      textFont: isMerchandise ? "montserrat" : DEFAULT_TEXT_FONT,
      logoFile: null,
      logoPreview: null,
      inkColor: "#1a1a1a",
      colorTextInput: "",
      positions: computeDefaultPositions(zoneForDefaults),
      elemScale: DEFAULT_SCALES,
      elemRotationOffset: DEFAULT_ROTATIONS,
      elemOrder: ["logo", "monogram", "names", "date"],
    }),
    [isMerchandise]
  );

  // Switches which print area is active: snapshots the outgoing area's
  // current on-screen design so it isn't lost, then loads the incoming
  // area's own saved design (or a fresh one if this is the first visit to
  // it) and jumps the displayed photo to that area's own reference image.
  const switchActiveZone = (newZoneId: string) => {
    if (newZoneId === activeZoneId) return;
    zoneDesignsRef.current[activeZoneId] = {
      names,
      date,
      monogram,
      frame,
      textFont,
      logoFile,
      logoPreview,
      inkColor,
      colorTextInput,
      positions,
      elemScale,
      elemRotationOffset,
      elemOrder,
    };
    const newZone = product.zones.find((z) => z.id === newZoneId);
    const next = zoneDesignsRef.current[newZoneId] ?? makeDefaultDesign(newZone);
    setNames(next.names);
    setDate(next.date);
    setMonogram(next.monogram);
    setFrame(next.frame);
    setTextFont(next.textFont);
    setLogoFile(next.logoFile);
    setLogoPreview(next.logoPreview);
    setInkColor(next.inkColor);
    setColorTextInput(next.colorTextInput);
    setPositions(next.positions);
    setElemScale(next.elemScale);
    setElemRotationOffset(next.elemRotationOffset);
    setElemOrder(next.elemOrder);
    setActiveElem(null);
    setActiveZoneId(newZoneId);

    // Always jump to this area's own photo — even one with no explicit
    // reference image_id set still needs to reset to the default (first)
    // photo, or switching away from an area that does have one and back
    // would leave the previous area's photo on screen.
    const newImageIndex = newZone?.image_id
      ? product.images.findIndex((img) => img.id === newZone.image_id)
      : -1;
    setActiveImage(newImageIndex >= 0 ? newImageIndex : 0);
  };

  // Toggles a secondary/tertiary area's inclusion in this order — adding
  // one also switches to it so the shopper can personalize it immediately;
  // removing one falls back to viewing the primary area.
  const toggleExtraZone = (zoneId: string) => {
    const wasSelected = selectedExtraZoneIds.has(zoneId);
    setSelectedExtraZoneIds((prev) => {
      const next = new Set(prev);
      if (wasSelected) next.delete(zoneId);
      else next.add(zoneId);
      return next;
    });
    if (wasSelected) {
      if (activeZoneId === zoneId && primaryZone) switchActiveZone(primaryZone.id);
    } else {
      switchActiveZone(zoneId);
    }
  };

  // BUG-01: restores the last design saved for this product, so reloading
  // or re-entering the URL picks up where the shopper left off instead of
  // the sample design. A handoff from another product's page (`handoff`
  // above) is a more recent, explicit signal than an old saved draft, so it
  // still takes priority, unchanged from today's behavior — this only
  // restores when there's no handoff. Guards every restored id (zone,
  // technique, variant) against still existing on the product, in case its
  // configuration changed since the design was saved.
  const hasRestoredRef = useRef(false);
  useEffect(() => {
    if (!product.personalizable || handoff) {
      hasRestoredRef.current = true;
      return;
    }
    let cancelled = false;
    designStorage.load(product.id, LATEST_VERSION_ID).then((saved) => {
      if (cancelled) return;
      if (saved) {
        const resolvedActiveZoneId =
          saved.activeZoneId && product.zones.some((z) => z.id === saved.activeZoneId)
            ? saved.activeZoneId
            : primaryZone?.id ?? "";
        zoneDesignsRef.current = saved.zones as Record<string, ZoneDesign>;
        const activeDesign = saved.zones[resolvedActiveZoneId];
        if (activeDesign) {
          setNames(activeDesign.names);
          setDate(activeDesign.date);
          setMonogram(activeDesign.monogram);
          setFrame(activeDesign.frame);
          setTextFont(activeDesign.textFont);
          setLogoFile(activeDesign.logoFile);
          setLogoPreview(activeDesign.logoPreview);
          setInkColor(activeDesign.inkColor);
          setColorTextInput(activeDesign.colorTextInput);
          setPositions(activeDesign.positions as Record<ElemKey, ElemPos>);
          setElemScale(activeDesign.elemScale as Record<ElemKey, number>);
          setElemRotationOffset(activeDesign.elemRotationOffset as Record<ElemKey, number>);
          setElemOrder(activeDesign.elemOrder as ElemKey[]);
        }
        setActiveZoneId(resolvedActiveZoneId);
        setSelectedExtraZoneIds(
          new Set(saved.selectedExtraZoneIds.filter((id) => product.zones.some((z) => z.id === id)))
        );
        if (product.techniques.some((t) => t.id === saved.techniqueId)) setTechniqueId(saved.techniqueId);
        if (product.variants.some((v) => v.id === saved.variantId)) setVariantId(saved.variantId);
        if (Number.isFinite(saved.quantity) && saved.quantity > 0) updateQuantity(saved.quantity);
        const newImageIndex = product.zones.find((z) => z.id === resolvedActiveZoneId)?.image_id
          ? product.images.findIndex((img) => img.id === product.zones.find((z) => z.id === resolvedActiveZoneId)?.image_id)
          : -1;
        setActiveImage(newImageIndex >= 0 ? newImageIndex : 0);
      }
      hasRestoredRef.current = true;
    });
    return () => {
      cancelled = true;
    };
    // Deliberately mount-only: restoring reacts to nothing after the page
    // has loaded (a later prop change can't happen — `product` is this
    // page's own fixed server-fetched data).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // BUG-01: saves the current design shortly after each change, debounced
  // so a burst of edits (typing, dragging) writes once, not per keystroke.
  // Waits for the restore above to finish first — saving before that would
  // overwrite a just-loaded draft with the page's blank initial state.
  useEffect(() => {
    if (!product.personalizable || !hasRestoredRef.current) return;
    const timeout = setTimeout(() => {
      const liveDesign: ZoneDesign = {
        names,
        date,
        monogram,
        frame,
        textFont,
        logoFile,
        logoPreview,
        inkColor,
        colorTextInput,
        positions,
        elemScale,
        elemRotationOffset,
        elemOrder,
      };
      designStorage.save({
        productId: product.id,
        versionId: LATEST_VERSION_ID,
        updatedAt: Date.now(),
        activeZoneId,
        selectedExtraZoneIds: Array.from(selectedExtraZoneIds),
        techniqueId,
        variantId,
        quantity,
        zones: { ...zoneDesignsRef.current, [activeZoneId]: liveDesign },
      });
    }, 600);
    return () => clearTimeout(timeout);
  }, [
    product.personalizable,
    product.id,
    names,
    date,
    monogram,
    frame,
    textFont,
    logoFile,
    logoPreview,
    inkColor,
    colorTextInput,
    positions,
    elemScale,
    elemRotationOffset,
    elemOrder,
    activeZoneId,
    selectedExtraZoneIds,
    techniqueId,
    variantId,
    quantity,
  ]);

  const [zoneRef, zoneSize] = useElementSize<HTMLDivElement>();
  // Measures the full photo container (not just the zone sub-box) so the
  // print area's true corners_pct — a possibly angled/trapezoidal quad, not
  // just zoneBox's axis-aligned bounding rectangle — can be converted to
  // real on-screen pixels for clamping drags and resizes against the
  // actual boundary a customer drew in the admin print-area tool.
  const [photoRef, photoSize] = useElementSize<HTMLDivElement>();

  const zoneBox = useMemo(() => (zone ? boundingBox(zone.corners_pct) : null), [zone]);

  // The draggable elements are positioned within zoneBox (its bounding box) —
  // that's the same coordinate space the AI render and snapshot compositors
  // use. But for angled/perspective products the actual print area is a
  // trapezoid, not that bounding rectangle, so the visible outline traces
  // the true quad (matching the admin print-area tool exactly) even though
  // it draws in the full-photo 0-100 space rather than zoneBox's.
  const zonePoints = useMemo(
    () => (zone ? zone.corners_pct.map((c) => `${c.x},${c.y}`).join(" ") : ""),
    [zone]
  );

  // Tilts the logo/text to match the print area's own incline (its top
  // edge, TL→TR) so personalization reads as embedded in an angled surface
  // instead of pasted on upright. Uses zoneBox's rendered pixel size to
  // convert the full-image percentage corners into real on-screen angles —
  // the container isn't square (aspect-[4/5]), so raw percentage deltas
  // alone would give a skewed angle.
  const autoRotationDeg = useMemo(() => {
    if (!zone || zone.corners_pct.length !== 4 || !zoneBox || !zoneBox.width || !zoneBox.height) return 0;
    if (!zoneSize.width || !zoneSize.height) return 0;
    const pxPerPctX = zoneSize.width / zoneBox.width;
    const pxPerPctY = zoneSize.height / zoneBox.height;
    const [tl, tr] = zone.corners_pct;
    const dx = (tr.x - tl.x) * pxPerPctX;
    const dy = (tr.y - tl.y) * pxPerPctY;
    return (Math.atan2(dy, dx) * 180) / Math.PI;
  }, [zone, zoneBox, zoneSize.width, zoneSize.height]);
  // Customers can nudge rotation further on top of the auto-matched angle
  // (e.g. the quad only approximates the surface, or they simply prefer it
  // off-axis) — each element gets its own independent offset via its own
  // on-canvas rotate handle.
  const elemRotationDeg: Record<ElemKey, number> = useMemo(
    () => ({
      logo: autoRotationDeg + elemRotationOffset.logo,
      monogram: autoRotationDeg + elemRotationOffset.monogram,
      names: autoRotationDeg + elemRotationOffset.names,
      date: autoRotationDeg + elemRotationOffset.date,
    }),
    [autoRotationDeg, elemRotationOffset]
  );

  // The print area's true corners in the SAME local pixel space as
  // photoSize (origin at the photo's own top-left) — a pure function of
  // already-tracked state, safe to compute during render, unlike a live
  // getBoundingClientRect() call.
  const quadCornersPx = useMemo<Point[] | null>(() => {
    if (!zone || zone.corners_pct.length !== 4 || !photoSize.width || !photoSize.height) return null;
    return zone.corners_pct.map((c) => ({ x: (c.x / 100) * photoSize.width, y: (c.y / 100) * photoSize.height }));
  }, [zone, photoSize.width, photoSize.height]);

  // Converts a position (0-100 within zoneBox, the coordinate space
  // `positions` are stored in) to that same photo-local pixel space.
  const posToPhotoPx = useCallback(
    (pos: ElemPos): Point | null => {
      if (!zoneBox || !photoSize.width || !photoSize.height) return null;
      const fullPctX = zoneBox.left + (pos.x / 100) * zoneBox.width;
      const fullPctY = zoneBox.top + (pos.y / 100) * zoneBox.height;
      return { x: (fullPctX / 100) * photoSize.width, y: (fullPctY / 100) * photoSize.height };
    },
    [zoneBox, photoSize.width, photoSize.height]
  );

  // The inverse of posToPhotoPx — used after a rotation gesture resolves an
  // element's center back inside the print area (BUG-03), to convert that
  // photo-local pixel point back into the zoneBox-relative % `positions` are
  // stored in.
  const photoPxToPos = useCallback(
    (pt: Point): ElemPos | null => {
      if (!zoneBox || !photoSize.width || !photoSize.height) return null;
      const fullPctX = (pt.x / photoSize.width) * 100;
      const fullPctY = (pt.y / photoSize.height) * 100;
      return {
        x: ((fullPctX - zoneBox.left) / zoneBox.width) * 100,
        y: ((fullPctY - zoneBox.top) / zoneBox.height) * 100,
      };
    },
    [zoneBox, photoSize.width, photoSize.height]
  );

  // Lets the customer drag the logo, monogram, names, and date independently
  // within the print area. Listeners stay attached for the component's
  // lifetime and no-op unless a drag is in progress.
  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      const state = dragState.current;
      if (!state) return;
      // Pointer-movement deltas are already in real screen pixels, and so
      // is photo-local space (1 photo-local unit == 1 rendered pixel) — so
      // the delta can be added directly to the drag's starting photo-local
      // position without any further conversion.
      const candidate: Point = {
        x: state.originPx.x + (e.clientX - state.startX),
        y: state.originPx.y + (e.clientY - state.startY),
      };
      const clamped =
        quadCornersPx && quadCornersPx.length === 4
          ? clampOrientedBoxToQuad(candidate, quadCornersPx, state.halfW, state.halfH, state.rotationRad)
          : candidate;
      if (!zoneBox || !photoSize.width || !photoSize.height) return;
      const fullPctX = (clamped.x / photoSize.width) * 100;
      const fullPctY = (clamped.y / photoSize.height) * 100;
      setPositions((prev) => ({
        ...prev,
        [state.key]: {
          x: ((fullPctX - zoneBox.left) / zoneBox.width) * 100,
          y: ((fullPctY - zoneBox.top) / zoneBox.height) * 100,
        },
      }));
    };
    const handleUp = () => {
      dragState.current = null;
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [quadCornersPx, zoneBox, photoSize.width, photoSize.height]);

  const startDrag = useCallback(
    (key: ElemKey) => (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setActiveElem(key);
      bringToFront(key);
      const box = elemBoxRefs.current[key];
      const originPx = posToPhotoPx(positions[key]);
      if (!originPx) return;
      // Half-width/half-height from the element's own untransformed layout
      // size (not the rotated getBoundingClientRect, which would inflate
      // these) combined with its current on-screen rotation — so the quad
      // clamp below sees the element's true rotated footprint instead of a
      // single circular margin that either clamps too early along its short
      // axis or lets it cross the boundary along its long axis.
      const halfW = box ? box.offsetWidth / 2 : 0;
      const halfH = box ? box.offsetHeight / 2 : 0;
      const rotationRad = (elemRotationDeg[key] * Math.PI) / 180;
      dragState.current = { key, startX: e.clientX, startY: e.clientY, originPx, halfW, halfH, rotationRad };
    },
    [positions, posToPhotoPx, bringToFront, elemRotationDeg]
  );

  // Direct-manipulation resize/rotate for each element, mirroring the
  // drag-to-move interaction: a handle at the element's corner scales it,
  // a handle above it rotates it, both tracked from the element's own
  // on-screen center (its own bounding rect, so it works regardless of
  // current rotation). One ref map covers all four elements.
  const elemBoxRefs = useRef<Partial<Record<ElemKey, HTMLDivElement>>>({});
  const setElemBoxRef = useCallback(
    (key: ElemKey) => (el: HTMLDivElement | null) => {
      if (el) elemBoxRefs.current[key] = el;
      else delete elemBoxRefs.current[key];
    },
    []
  );

  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      const state = elemAdjustState.current;
      if (!state) return;
      if (state.mode === "resize") {
        const dist = Math.hypot(e.clientX - state.centerX, e.clientY - state.centerY);
        const ratio = state.startDist > 0 ? dist / state.startDist : 1;
        const uncapped = state.startScale * ratio;
        const next = Math.max(0.3, Math.min(state.maxScale, uncapped));
        // BUG-10: dragging past the print area's own limit doesn't just
        // silently stop growing — it says so, for as long as the drag keeps
        // pushing past it.
        setElemNotice(
          uncapped > state.maxScale ? { key: state.key, message: "Max size for this print area" } : null
        );
        setElemScale((prev) => ({ ...prev, [state.key]: next }));
      } else {
        const angle = (Math.atan2(e.clientY - state.centerY, e.clientX - state.centerX) * 180) / Math.PI;
        const delta = angle - state.startAngle;
        const next = Math.max(-45, Math.min(45, state.startRotation + delta));
        // BUG-03: a rotation that would otherwise leave part of the element
        // outside the print area is resolved immediately, every move event
        // — first by nudging the element back inside at its current size,
        // and only if that alone isn't enough, by also shrinking it to the
        // largest size that fits (with a brief notice either way).
        if (state.quadCornersPx && state.centerPhotoPx && state.naturalHalfW > 0 && state.naturalHalfH > 0) {
          const rotationRad = ((state.autoRotationDeg + next) * Math.PI) / 180;
          const resolved = resolveRotatedContainment(
            state.centerPhotoPx,
            state.quadCornersPx,
            state.naturalHalfW,
            state.naturalHalfH,
            rotationRad
          );
          const resolvedPos = photoPxToPos(resolved.center);
          if (resolvedPos) {
            setPositions((prev) => ({ ...prev, [state.key]: resolvedPos }));
          }
          // Recomputed fresh from the gesture's original (unshrunk) size on
          // every move event, not accumulated from a previous event's
          // result — so rotating back to a safe angle restores the element
          // to its starting size instead of leaving it shrunk.
          setElemScale((prev) => ({ ...prev, [state.key]: state.startScale * resolved.scale }));
          setElemNotice(resolved.resized ? { key: state.key, message: "Resized to fit the print area" } : null);
        }
        setElemRotationOffset((prev) => ({ ...prev, [state.key]: next }));
      }
    };
    const handleUp = () => {
      elemAdjustState.current = null;
      setElemNotice(null);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [photoPxToPos]);

  // Real px-per-mm for the currently rendered zone box, so text/logo sizing
  // reflects the product's actual printable area instead of a fixed guess.
  const mmPerPx = useMemo(() => {
    if (!zone?.width_mm || !zoneSize.width) return null;
    return zone.width_mm / zoneSize.width;
  }, [zone, zoneSize.width]);
  const pxPerMm = mmPerPx ? 1 / mmPerPx : null;
  // Available width for auto-fitting names/date text, measured along the
  // element's own (possibly rotated) axis from its actual current position
  // out to the print area's TRUE quad boundary — not a flat percentage of
  // zoneSize.width, which either overshoots a trapezoidal print area or
  // falls needlessly short of a rectangular one depending on where the
  // element sits and how it's rotated. Just one small margin (matching the
  // resize handle's own 0.98 cap below) rather than two independently
  // tuned margins stacking into a much bigger gap than either alone
  // intended — which used to leave roughly a centimeter of unusable space
  // before the real edge.
  const textAvailableWidth = useCallback(
    (key: "names" | "date") => {
      const fallback = zoneSize.width * 0.97;
      const origin = posToPhotoPx(positions[key]);
      if (!origin || !quadCornersPx) return fallback;
      const theta = (elemRotationDeg[key] * Math.PI) / 180;
      const dir: Point = { x: Math.cos(theta), y: Math.sin(theta) };
      const avail = 2 * availableAlongAxis(origin, dir, quadCornersPx) * 0.98;
      return Number.isFinite(avail) && avail > 0 ? avail : fallback;
    },
    [zoneSize.width, posToPhotoPx, positions, quadCornersPx, elemRotationDeg]
  );
  const nameFontPx = fitTextFontSize(
    names,
    (pxPerMm ? Math.max(10, Math.min(28, pxPerMm * 5)) : 18) * elemScale.names,
    textAvailableWidth("names")
  );
  const monogramFontPx = (pxPerMm ? Math.max(12, Math.min(32, pxPerMm * 6)) : 20) * elemScale.monogram;
  // formattedDate isn't declared yet at this point in the component, but
  // it's always exactly 10 characters ("DD·MM·YYYY"), so that's used
  // directly rather than reordering declarations.
  const dateFontPx = fitTextFontSize(
    "0000000000",
    (pxPerMm ? Math.max(8, Math.min(14, pxPerMm * 2.4)) : 11) * elemScale.date,
    textAvailableWidth("date")
  );

  // Default logo footprint: 45% of the print area's smaller physical
  // dimension (width_mm/height_mm, entered when the product was set up) —
  // not a flat percentage of the box — so it's proportionate whether the
  // zone is small or large, wide or tall. Mirrors defaultLogoBoxSize() in
  // the server-side compositor. elemScale.logo is the customer's own
  // on-top multiplier from the resize handle.
  const logoWidthPct = useMemo(() => {
    const fallbackPct = 45 * elemScale.logo;
    if (!zone?.width_mm || !zone?.height_mm || !zoneSize.width || !zoneSize.height) return fallbackPct;
    const pxPerMmX = zoneSize.width / zone.width_mm;
    const pxPerMmY = zoneSize.height / zone.height_mm;
    const scale = Math.min(pxPerMmX, pxPerMmY);
    const smallerMm = Math.min(zone.width_mm, zone.height_mm);
    const logoBoxPx = scale * smallerMm * 0.45 * elemScale.logo;
    // No hardcoded ceiling here — the resize handle already computes, per
    // drag, how far this can grow before exceeding the print area itself
    // (both width and height), so it's the sole limit on how big the logo
    // can get.
    return (logoBoxPx / zoneSize.width) * 100;
  }, [zone, zoneSize.width, zoneSize.height, elemScale.logo]);

  // The logo's real-world footprint width in mm, on the actual product —
  // same 45%-of-the-smaller-dimension math as logoWidthPct above, just
  // expressed in mm instead of a % of the rendered box, so it can be
  // compared against the uploaded file's real pixel count for a print-DPI
  // estimate below.
  const logoWidthMm = useMemo(() => {
    if (!zone?.width_mm || !zone?.height_mm) return null;
    const smallerMm = Math.min(zone.width_mm, zone.height_mm);
    return smallerMm * 0.45 * elemScale.logo;
  }, [zone, elemScale.logo]);

  const logoPrintDpi = useMemo(() => {
    if (!logoNaturalSize || !logoWidthMm) return null;
    return estimatePrintDpi(logoNaturalSize.width, logoWidthMm);
  }, [logoNaturalSize, logoWidthMm]);
  const logoIsLowRes = logoPrintDpi !== null && logoPrintDpi < MIN_PRINT_DPI;

  const startElemAdjust = useCallback(
    (key: ElemKey, mode: "resize" | "rotate") => (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const box = elemBoxRefs.current[key];
      if (!box) return;
      const rect = box.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      // Cap growth at the print area's own true boundary (with a little
      // breathing room) rather than an arbitrary fixed multiplier — so an
      // element can be enlarged right up to filling the print area, and no
      // further. Measured against offsetWidth/Height (the element's own
      // untransformed layout size) rather than the rotated
      // getBoundingClientRect — once an element is tilted to match an
      // angled print area, its rotated AABB is larger than its true
      // footprint, which was silently collapsing this ceiling down to the
      // current size (no further growth allowed at all).
      const currentScale = elemScale[key] || 1;
      // For "names", box.offsetWidth/Height only cover the text itself — a
      // decorative frame draws further out around it (padding proportional
      // to the current font size, see the frame's `inset`/`calc()` styling
      // below), so the cap has to account for that extra footprint too, or
      // the frame could balloon past the print area even while the text
      // "natural" size still measured as comfortably within it.
      const framePadX = key === "names" && frame ? nameFontPx * 1.4 : 0;
      const framePadY = key === "names" && frame ? nameFontPx * 0.9 : 0;
      const naturalW = box.offsetWidth + framePadX;
      const naturalH = box.offsetHeight + framePadY;
      // The available room is measured against the element's own true
      // rotated footprint (its actual on-screen orientation, matching the
      // print area's incline) rather than a single conservative
      // nearestEdgeDistance radius — that circular bound always assumed the
      // element could need equal room in every direction, which under-caps
      // an element that's tilted to align with the print area (it should be
      // able to grow right up along the incline's long axis, not just to
      // whatever the shortest nearby edge allows).
      const centerPhotoPx = posToPhotoPx(positions[key]);
      const rotationRad = (elemRotationDeg[key] * Math.PI) / 180;
      const growthRatio =
        quadCornersPx && centerPhotoPx && naturalW > 0 && naturalH > 0
          ? maxOrientedBoxScale(centerPhotoPx, quadCornersPx, naturalW / 2, naturalH / 2, rotationRad)
          : null;
      // A hard ceiling on the *absolute* elemScale value, not a multiplier
      // off whatever the current scale happens to be — currentScale cancels
      // out of growthRatio (naturalW/H already reflect it), so
      // currentScale * growthRatio is the one true scale at which the
      // element/frame's rotated footprint would exactly reach the quad's
      // boundary from its current position. No flooring at currentScale: if
      // something already exceeds that (e.g. a stale/looser cap from before
      // this fix), the next resize gesture must be allowed to shrink it back
      // down, not just refuse to grow it further.
      const maxScale =
        growthRatio != null && Number.isFinite(growthRatio)
          ? Math.max(0.3, currentScale * growthRatio * 0.98)
          : 4;
      elemAdjustState.current = {
        key,
        mode,
        centerX,
        centerY,
        startDist: Math.hypot(e.clientX - centerX, e.clientY - centerY),
        startAngle: (Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180) / Math.PI,
        startScale: currentScale,
        startRotation: elemRotationOffset[key],
        maxScale,
        quadCornersPx,
        centerPhotoPx,
        naturalHalfW: naturalW / 2,
        naturalHalfH: naturalH / 2,
        autoRotationDeg,
      };
    },
    [
      elemScale,
      elemRotationOffset,
      elemRotationDeg,
      frame,
      nameFontPx,
      posToPhotoPx,
      positions,
      quadCornersPx,
      autoRotationDeg,
    ]
  );

  const technique = product.techniques.find((t) => t.id === techniqueId);
  const variant = product.variants.find((v) => v.id === variantId);

  const singleColorFillMode = technique?.singleColorInk ? technique.singleColorFillMode ?? "silhouette" : null;
  const pantoneMatch = useMemo(
    () => (technique?.singleColorInk ? nearestPantone(inkColor) : null),
    [technique?.singleColorInk, inkColor]
  );
  // The customer's chosen ink color is the whole point of a single-color-ink
  // technique — one ink prints/etches everything, so it has to apply to
  // every personalization element (monogram, frame, names, date), not just
  // the logo silhouette. Non-single-color techniques keep their fixed
  // per-technique preview color as before.
  const effectiveInkColor = technique?.singleColorInk ? inkColor : techniqueInkColor(technique?.technique);
  const applyColorTextInput = useCallback(() => {
    const resolved = resolveColorInput(colorTextInput);
    if (resolved) setInkColor(resolved.hex);
  }, [colorTextInput]);

  // Flattens the uploaded logo into a solid silhouette in the customer's
  // chosen ink color — only for a single-color-ink technique in
  // "silhouette" fill mode. Recomputed whenever the logo or chosen color
  // changes; the technique's own fill-mode choice doesn't affect the
  // *shape*, only whether this recolored version is what actually gets
  // shown/submitted.
  useEffect(() => {
    if (!logoPreview || singleColorFillMode !== "silhouette") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLogoSilhouetteUrl(null);
      return;
    }
    let cancelled = false;
    recolorLogoToSolid(logoPreview, inkColor)
      .then((url) => {
        if (!cancelled) setLogoSilhouetteUrl(url);
      })
      .catch(() => {
        if (!cancelled) setLogoSilhouetteUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [logoPreview, inkColor, singleColorFillMode]);

  // The logo image actually shown/submitted: the ink-colored silhouette
  // when that fill mode is active, otherwise the logo exactly as uploaded.
  const effectiveLogoDataUrl =
    singleColorFillMode === "silhouette" && logoSilhouetteUrl ? logoSilhouetteUrl : logoPreview;

  // Traces the uploaded logo into vector path data as soon as it's picked —
  // any personalizable product's print-ready outline file needs the logo as
  // true curves, not just single-color-ink ones (that flag only decides
  // which color fills it and whether the live preview shows a recolored
  // silhouette; every technique still needs *some* vector representation of
  // the logo in its outline export, filled with that technique's own ink
  // color as a fallback). Keyed off the logo itself, not the chosen color:
  // the traced shape doesn't change when the ink color changes, only its
  // fill at render/export time.
  useEffect(() => {
    if (!logoPreview) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLogoVector(null);
      return;
    }
    let cancelled = false;
    fetch("/api/vectorize-logo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logoDataUrl: logoPreview }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled) setLogoVector(json && json.ds ? json : null);
      })
      .catch(() => {
        if (!cancelled) setLogoVector(null);
      });
    return () => {
      cancelled = true;
    };
  }, [logoPreview]);

  // Measures the uploaded logo's real pixel dimensions (for the print-quality
  // check below) and samples its color palette, so the customer/back office
  // can see both without any extra action — recomputed whenever a new logo
  // (or a background-removed version of the same logo) is set.
  useEffect(() => {
    if (!logoPreview) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLogoNaturalSize(null);
      setDetectedColors([]);
      return;
    }
    let cancelled = false;
    const img = new window.Image();
    img.onload = () => {
      if (!cancelled) setLogoNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = logoPreview;
    // Key out a flat white background first (without touching the visible
    // logoPreview) so a flattened upload with no real alpha doesn't count
    // its own background as a detected "color" — removeLogoBackground
    // already no-ops when there's nothing to key or real alpha exists.
    removeLogoBackground(logoPreview)
      .then((keyed) => detectLogoColors(keyed))
      .then((colors) => {
        if (!cancelled) setDetectedColors(colors);
      })
      .catch(() => {
        if (!cancelled) setDetectedColors([]);
      });
    return () => {
      cancelled = true;
    };
  }, [logoPreview]);

  const handleRemoveBackground = async () => {
    if (!logoPreview) return;
    setRemovingBackground(true);
    try {
      const result = await removeLogoBackground(logoPreview);
      setLogoPreview(result);
      const blob = await dataUrlToBlob(result);
      setLogoFile(new File([blob], logoFile?.name ?? "logo.png", { type: blob.type || "image/png" }));
    } catch {
      // Best-effort — leave the logo as-is if the canvas step fails.
    } finally {
      setRemovingBackground(false);
    }
  };

  const basePrice = product.factoryPrice + (variant?.price_delta ?? 0);
  const unitPriceWithVariant = applyMarkup(basePrice, product.markupPct);
  const extraAreas = product.zones.filter((z) => selectedExtraZoneIds.has(z.id));
  const areasExtraPrice = extraAreas.reduce((sum, z) => sum + z.extra_price, 0);
  const unitPriceWithTechnique = unitPriceWithVariant + (technique?.extra_price ?? 0) + areasExtraPrice;
  const total = unitPriceWithTechnique * quantity;
  const productionTime = leadTimeRange(product.leadTimeMin, product.leadTimeMax);

  const displayImage = variant?.image_url ?? product.images[activeImage]?.url ?? product.images[0]?.url;
  const showOverlayHere = !zone?.image_id || product.images[activeImage]?.id === zone.image_id;

  // Real-world size readouts (cm) shown next to each field below, computed
  // from the same px-per-mm conversion the on-canvas sizing uses — only
  // available once the product's print-area mm dimensions and rendered box
  // are both known. Shown as width x height (not just a single font-size
  // number) so it reads as the element's actual footprint on the product.
  const sizeLabelWH = (widthPx: number, heightPx: number) =>
    mmPerPx ? `≈ ${((widthPx * mmPerPx) / 10).toFixed(1)}×${((heightPx * mmPerPx) / 10).toFixed(1)} cm` : null;
  const logoWidthPx = zoneSize.width ? (logoWidthPct / 100) * zoneSize.width : 0;
  const logoSizeLabel = sizeLabelWH(logoWidthPx, logoWidthPx);
  const monogramSizeLabel = sizeLabelWH(monogramFontPx, monogramFontPx);
  const nameLineCount = textLineCount(names);
  const nameSizeLabel = sizeLabelWH(estimateTextWidth(names, nameFontPx), nameFontPx * 1.25 * nameLineCount);
  const dateSizeLabel = sizeLabelWH(estimateTextWidth("0000000000", dateFontPx), dateFontPx);

  const formattedDate = useMemo(() => formatPrintDate(date), [date]);

  // "Your names or event text" is the only required personalization field
  // (BUG-02) — products without a customizer at all have nothing to
  // validate here.
  const namesValid = !product.personalizable || isNamesValid(names);
  const namesErrorId = "names-required-error";
  const quantityErrorId = "quantity-minimum-error";

  const baseQuickQuantities = [product.minOrder, product.minOrder * 2, product.minOrder * 4, product.minOrder * 8];
  const popularQty = product.popularQty && product.popularQty >= product.minOrder ? product.popularQty : null;
  const quickQuantities =
    popularQty && !baseQuickQuantities.includes(popularQty)
      ? [...baseQuickQuantities, popularQty].sort((a, b) => a - b)
      : baseQuickQuantities;

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(await fileToDataUrl(file));
  };

  const clearLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
  };

  const handleAddToCart = () => submitToCart(false);
  const handleAddSample = () => submitToCart(true);

  // Shared by the normal Add to Cart button and "Buy 1 sample" — same
  // render/snapshot capture either way, since a sample is exactly the
  // customer's current configuration, just forced to a single piece with
  // its own flat setup fee instead of the product's usual quantity rules.
  // Builds one print area's render/snapshot fields — shared by the primary
  // area and every additional one the shopper added, since each needs the
  // same capture against its own design and its own reference photo.
  const buildAreaResult = async (
    client: ReturnType<typeof createClient>,
    uploadBase: string,
    zoneId: string,
    design: ZoneDesign,
    precomputedLogoVector?: { ds: string[]; width: number; height: number } | null
  ) => {
    let renderUrl: string | undefined;
    let renderContextUrl: string | undefined;
    // Only whichever area the AI render was actually generated for gets it
    // — the AI preview is an explicit, rate-limited action the shopper
    // triggers per area, never auto-run for every area on Add to Cart.
    if (latestRender && latestRender.zoneId === zoneId) {
      try {
        const productBlob = await dataUrlToBlob(latestRender.imageDataUrl);
        const { error: uploadError } = await client.storage
          .from("personalization-renders")
          .upload(`${uploadBase}-${zoneId}-product.png`, productBlob, { contentType: "image/png" });
        if (!uploadError) {
          renderUrl = client.storage
            .from("personalization-renders")
            .getPublicUrl(`${uploadBase}-${zoneId}-product.png`).data.publicUrl;
        }
        if (latestRender.contextImageDataUrl) {
          const contextBlob = await dataUrlToBlob(latestRender.contextImageDataUrl);
          const { error: contextError } = await client.storage
            .from("personalization-renders")
            .upload(`${uploadBase}-${zoneId}-context.png`, contextBlob, { contentType: "image/png" });
          if (!contextError) {
            renderContextUrl = client.storage
              .from("personalization-renders")
              .getPublicUrl(`${uploadBase}-${zoneId}-context.png`).data.publicUrl;
          }
        }
      } catch {
        // Best-effort — still add to cart even if the upload fails.
      }
    }

    // Always capture a plain (non-AI) snapshot of exactly what the customer
    // configured for this area — photo, text, positions, technique — so the
    // supplier and admin have a visual record even when the customer
    // skipped the optional AI preview. Reuse the AI render if one was
    // already made for this area (it's the same configuration, already
    // uploaded).
    let snapshotUrl: string | undefined = renderUrl;
    const hasContent = !!(design.names.trim() || design.date.trim() || design.monogram.trim() || design.logoFile);
    if (!snapshotUrl && product.personalizable && hasContent) {
      try {
        const logoDataUrl =
          design.logoPreview && singleColorFillMode === "silhouette"
            ? await recolorLogoToSolid(design.logoPreview, design.inkColor).catch(() => design.logoPreview!)
            : design.logoPreview ?? undefined;
        const zoneRow = product.zones.find((z) => z.id === zoneId);
        const res = await fetch("/api/personalization-snapshot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId: product.id,
            zoneId,
            imageId: zoneRow?.image_id ?? undefined,
            names: design.names,
            date: design.date,
            monogram: design.monogram,
            frame: design.frame,
            textFont: design.textFont,
            logoDataUrl,
            positions: design.positions,
            elemScale: design.elemScale,
            elemRotationOffsetDeg: design.elemRotationOffset,
          }),
        });
        if (res.ok) {
          const json = await res.json();
          const blob = await dataUrlToBlob(json.imageDataUrl);
          const path = `${uploadBase}-${zoneId}-snapshot.png`;
          const { error: uploadError } = await client.storage
            .from("personalization-renders")
            .upload(path, blob, { contentType: "image/png" });
          if (!uploadError) {
            snapshotUrl = client.storage.from("personalization-renders").getPublicUrl(path).data.publicUrl;
          }
        }
      } catch {
        // Best-effort — still add to cart even if the snapshot fails.
      }
    }

    // The logo's traced outline — needed for the print-ready export
    // regardless of technique, same as the live logoVector effect above.
    // Reuse the currently-active area's already-fetched vector (it started
    // tracing as soon as that logo was picked, see the effect above) rather
    // than re-requesting it; any other area fetches fresh here.
    let logoVector = precomputedLogoVector ?? null;
    if (precomputedLogoVector === undefined && design.logoPreview) {
      try {
        const res = await fetch("/api/vectorize-logo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ logoDataUrl: design.logoPreview }),
        });
        const json = res.ok ? await res.json() : null;
        logoVector = json && json.ds ? json : null;
      } catch {
        logoVector = null;
      }
    }

    return { renderUrl, renderContextUrl, snapshotUrl, logoVector };
  };

  const submitToCart = async (sample: boolean) => {
    if (sample) setAddingSample(true);
    else setAddingToCart(true);

    const client = createClient();
    const uploadBase = `${product.plannerSlug}/${product.id}/${crypto.randomUUID()}`;

    // Every zone's design, including whatever's live on screen right now
    // for the currently active one — zoneDesignsRef only has the *other*
    // zones' saved snapshots, since the active one lives in plain state.
    const liveDesign: ZoneDesign = {
      names,
      date,
      monogram,
      frame,
      textFont,
      logoFile,
      logoPreview,
      inkColor,
      colorTextInput,
      positions,
      elemScale,
      elemRotationOffset,
      elemOrder,
    };
    const allDesigns: Record<string, ZoneDesign> = { ...zoneDesignsRef.current, [activeZoneId]: liveDesign };

    const primaryDesign = (primaryZone && allDesigns[primaryZone.id]) ?? liveDesign;
    const primaryResult = primaryZone
      ? await buildAreaResult(
          client,
          uploadBase,
          primaryZone.id,
          primaryDesign,
          primaryZone.id === activeZoneId ? logoVector : undefined
        )
      : { renderUrl: undefined, renderContextUrl: undefined, snapshotUrl: undefined, logoVector: null };

    const additionalAreas: AreaPersonalization[] = [];
    for (const z of extraAreas) {
      const design = allDesigns[z.id] ?? makeDefaultDesign(z);
      const result = await buildAreaResult(
        client,
        uploadBase,
        z.id,
        design,
        z.id === activeZoneId ? logoVector : undefined
      );
      additionalAreas.push({
        zoneId: z.id,
        label: z.label,
        extraPrice: z.extra_price,
        names: design.names,
        date: design.date,
        monogram: design.monogram,
        frame: design.frame,
        textFont: design.textFont,
        positions: design.positions,
        elemScale: design.elemScale,
        elemRotationOffset: design.elemRotationOffset,
        hasLogo: !!design.logoFile,
        renderUrl: result.renderUrl,
        snapshotUrl: result.snapshotUrl,
        inkColorHex: technique?.singleColorInk ? design.inkColor : undefined,
        inkPantoneCode: technique?.singleColorInk ? nearestPantone(design.inkColor)?.code : undefined,
        logoVector: result.logoVector,
      });
    }

    // Primary area's own reference photo — kept stable for the cart line's
    // thumbnail regardless of which area happened to be on screen when the
    // customer clicked Add to Cart.
    const primaryImageIndex = primaryZone?.image_id
      ? product.images.findIndex((i) => i.id === primaryZone.image_id)
      : -1;
    const primaryDisplayImage =
      variant?.image_url ?? product.images[primaryImageIndex >= 0 ? primaryImageIndex : 0]?.url ?? product.images[0]?.url;

    const extraKeyPart = extraAreas
      .map((z) => {
        const d = allDesigns[z.id] ?? makeDefaultDesign(z);
        return `${z.id}:${d.names}:${d.date}:${d.monogram}:${d.frame}`;
      })
      .sort()
      .join("|");

    addItem({
      key: sample
        ? `${product.id}:${variantId}:${primaryDesign.names}:${primaryDesign.date}:${primaryDesign.monogram}:${primaryDesign.frame}:${techniqueId}:${extraKeyPart}:sample:${crypto.randomUUID()}`
        : `${product.id}:${variantId}:${primaryDesign.names}:${primaryDesign.date}:${primaryDesign.monogram}:${primaryDesign.frame}:${techniqueId}:${extraKeyPart}`,
      productId: product.id,
      slug: product.slug,
      name: variant ? `${product.name} — ${variant.label}` : product.name,
      image: primaryDisplayImage ?? null,
      unitPrice: unitPriceWithTechnique,
      quantity: sample ? 1 : quantity,
      minOrder: sample ? 1 : product.minOrder,
      leadTimeMin: product.leadTimeMin,
      leadTimeMax: product.leadTimeMax,
      variantId: variant?.id,
      variantLabel: variant?.label,
      isSample: sample || undefined,
      sampleFee: sample ? SAMPLE_FEE : undefined,
      personalization: product.personalizable
        ? {
            zoneId: primaryZone?.id,
            names: primaryDesign.names,
            date: primaryDesign.date,
            monogram: primaryDesign.monogram,
            frame: primaryDesign.frame,
            textFont: primaryDesign.textFont,
            technique: technique?.technique,
            positions: primaryDesign.positions,
            elemScale: primaryDesign.elemScale,
            elemRotationOffset: primaryDesign.elemRotationOffset,
            hasLogo: !!primaryDesign.logoFile,
            renderUrl: primaryResult.renderUrl,
            renderContextUrl: primaryResult.renderContextUrl,
            snapshotUrl: primaryResult.snapshotUrl,
            inkColorHex: technique?.singleColorInk ? primaryDesign.inkColor : undefined,
            inkPantoneCode: technique?.singleColorInk ? nearestPantone(primaryDesign.inkColor)?.code : undefined,
            logoVector: primaryResult.logoVector,
            additionalAreas: additionalAreas.length > 0 ? additionalAreas : undefined,
          }
        : undefined,
    });
    if (sample) {
      setAddingSample(false);
      setSampleAdded(true);
      setTimeout(() => setSampleAdded(false), 2000);
    } else {
      setAddingToCart(false);
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 2000);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
    <div className="grid md:grid-cols-2 gap-12">
      <div>
        <div
          ref={photoRef}
          className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-cream mb-4"
          onPointerDown={() => setActiveElem(null)}
        >
          {displayImage && <Image src={displayImage} alt={product.name} fill className="object-cover" priority />}
          {product.personalizable && zone && showOverlayHere && (
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="absolute inset-0 w-full h-full pointer-events-none"
            >
              <polygon
                points={zonePoints}
                fill="none"
                stroke="rgba(250,247,240,0.85)"
                strokeWidth={0.6}
                strokeDasharray="2.4,1.5"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          )}
          {product.personalizable && zone && zoneBox && showOverlayHere && (
            <div
              ref={zoneRef}
              className="absolute pointer-events-none text-dark text-center overflow-visible"
              style={{
                left: `${zoneBox.left}%`,
                top: `${zoneBox.top}%`,
                width: `${zoneBox.width}%`,
                height: `${zoneBox.height}%`,
              }}
            >
              {logoPreview && (
                <div
                  ref={setElemBoxRef("logo")}
                  onPointerDown={startDrag("logo")}
                  className="absolute pointer-events-auto cursor-move touch-none"
                  style={{
                    left: `${positions.logo.x}%`,
                    top: `${positions.logo.y}%`,
                    width: `${logoWidthPct}%`,
                    aspectRatio: "1",
                    zIndex: elemOrder.indexOf("logo"),
                    transform: `translate(-50%, -50%) rotate(${elemRotationDeg.logo}deg)`,
                  }}
                >
                  <div className="relative w-full h-full pointer-events-none">
                    <Image
                      src={effectiveLogoDataUrl ?? logoPreview}
                      alt=""
                      fill
                      className="object-contain"
                      style={
                        technique?.stripSourceColor && !technique?.singleColorInk
                          ? { filter: "grayscale(1)" }
                          : undefined
                      }
                      unoptimized
                    />
                  </div>
                  {activeElem === "logo" && (
                    <AdjustHandles
                      onResizeStart={startElemAdjust("logo", "resize")}
                      onRotateStart={startElemAdjust("logo", "rotate")}
                      notice={elemNotice?.key === "logo" ? elemNotice.message : undefined}
                    />
                  )}
                </div>
              )}
              {monogram && (
                <div
                  ref={setElemBoxRef("monogram")}
                  onPointerDown={startDrag("monogram")}
                  className="absolute pointer-events-auto cursor-move touch-none select-none"
                  style={{
                    left: `${positions.monogram.x}%`,
                    top: `${positions.monogram.y}%`,
                    width: monogramFontPx,
                    height: monogramFontPx,
                    zIndex: elemOrder.indexOf("monogram"),
                    transform: `translate(-50%, -50%) rotate(${elemRotationDeg.monogram}deg)`,
                  }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    width={monogramFontPx}
                    height={monogramFontPx}
                    className="pointer-events-none"
                    dangerouslySetInnerHTML={{
                      __html: monogramSvgInner(monogram, effectiveInkColor),
                    }}
                  />
                  {activeElem === "monogram" && (
                    <AdjustHandles
                      onResizeStart={startElemAdjust("monogram", "resize")}
                      onRotateStart={startElemAdjust("monogram", "rotate")}
                      notice={elemNotice?.key === "monogram" ? elemNotice.message : undefined}
                    />
                  )}
                </div>
              )}
              {names && (
                <div
                  ref={setElemBoxRef("names")}
                  onPointerDown={startDrag("names")}
                  className="absolute pointer-events-auto cursor-move touch-none select-none font-serif flex flex-col items-center leading-tight"
                  style={{
                    left: `${positions.names.x}%`,
                    top: `${positions.names.y}%`,
                    zIndex: elemOrder.indexOf("names"),
                    transform: `translate(-50%, -50%) rotate(${elemRotationDeg.names}deg)`,
                    fontSize: nameFontPx,
                    ...textFontStyle(textFont),
                    ...techniqueTextStyle(technique?.technique, effectiveInkColor),
                  }}
                >
                  {frame && (
                    <svg
                      viewBox="0 0 200 90"
                      preserveAspectRatio="none"
                      className="absolute pointer-events-none"
                      style={{
                        inset: `${-nameFontPx * 0.45}px ${-nameFontPx * 0.7}px`,
                        width: `calc(100% + ${nameFontPx * 1.4}px)`,
                        height: `calc(100% + ${nameFontPx * 0.9}px)`,
                      }}
                      dangerouslySetInnerHTML={{
                        __html: frameSvgInner(frame, effectiveInkColor),
                      }}
                    />
                  )}
                  {names.split("\n").map((line, i) => (
                    <span key={i} className="relative whitespace-nowrap">
                      {line}
                    </span>
                  ))}
                  {activeElem === "names" && (
                    <AdjustHandles
                      onResizeStart={startElemAdjust("names", "resize")}
                      onRotateStart={startElemAdjust("names", "rotate")}
                      notice={elemNotice?.key === "names" ? elemNotice.message : undefined}
                      expandBy={frame ? { x: nameFontPx * 0.7, y: nameFontPx * 0.45 } : undefined}
                    />
                  )}
                </div>
              )}
              {date && (
                <div
                  ref={setElemBoxRef("date")}
                  onPointerDown={startDrag("date")}
                  className="absolute pointer-events-auto cursor-move touch-none select-none tracking-wide whitespace-nowrap"
                  style={{
                    left: `${positions.date.x}%`,
                    top: `${positions.date.y}%`,
                    zIndex: elemOrder.indexOf("date"),
                    transform: `translate(-50%, -50%) rotate(${elemRotationDeg.date}deg)`,
                    fontSize: dateFontPx,
                    ...textFontStyle(textFont),
                    ...techniqueTextStyle(technique?.technique, effectiveInkColor),
                  }}
                >
                  {formattedDate}
                  {activeElem === "date" && (
                    <AdjustHandles
                      onResizeStart={startElemAdjust("date", "resize")}
                      onRotateStart={startElemAdjust("date", "rotate")}
                      notice={elemNotice?.key === "date" ? elemNotice.message : undefined}
                    />
                  )}
                </div>
              )}
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

        <RelatedProductsRail
          products={relatedProducts}
          base={`/store/${product.plannerSlug}`}
          names={names}
          date={date}
          monogram={monogram}
          logoDataUrl={logoPreview}
          frame={frame}
          textFont={textFont}
          elemScale={elemScale}
          positions={positions}
          elemRotationOffset={elemRotationOffset}
          quantity={quantity}
        />
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
        {productionTime && <p className="text-sm text-muted mb-3">Production time: {productionTime}</p>}
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
            {product.zones.length > 1 && (
              <div>
                <p className="text-xs uppercase tracking-wide text-muted mb-2">Print area</p>
                <div className="flex flex-wrap gap-2">
                  {product.zones.map((z, i) => {
                    const isPrimary = i === 0;
                    const isActive = z.id === activeZoneId;
                    const isIncluded = isPrimary || selectedExtraZoneIds.has(z.id);
                    return (
                      <button
                        key={z.id}
                        type="button"
                        onClick={() => (isPrimary ? switchActiveZone(z.id) : toggleExtraZone(z.id))}
                        className={`px-3 py-2 rounded-lg text-sm border ${
                          isActive ? "border-dark bg-cream" : isIncluded ? "border-dark/60" : "border-line"
                        }`}
                      >
                        {z.label}
                        {!isPrimary && (
                          <span className="text-xs text-muted ml-1">
                            {isIncluded
                              ? "✓"
                              : z.extra_price > 0
                              ? `+${formatUSD(z.extra_price)}`
                              : "+ add"}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <CollapsibleSection title="Your logo" optional>
              <div className="flex items-center gap-3">
                <label className="relative h-16 w-16 rounded-lg overflow-hidden border border-line cursor-pointer bg-white shrink-0">
                  {effectiveLogoDataUrl ? (
                    <Image src={effectiveLogoDataUrl} alt="" fill className="object-contain" unoptimized />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] text-muted text-center px-1">
                      Upload
                    </span>
                  )}
                  <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
                </label>
                {logoPreview && (
                  <div className="flex flex-col items-start gap-1.5">
                    <button
                      type="button"
                      onClick={handleRemoveBackground}
                      disabled={removingBackground}
                      className="text-xs text-dark font-medium underline underline-offset-2 disabled:opacity-50"
                    >
                      {removingBackground ? "Removing background…" : "Remove background"}
                    </button>
                    <button
                      type="button"
                      onClick={clearLogo}
                      className="text-xs text-terracotta-dark font-medium"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
              {logoPreview && logoSizeLabel && <p className="text-xs text-muted mt-1">{logoSizeLabel}</p>}
              {logoPreview && logoIsLowRes && (
                <p className="text-xs text-red-600 mt-2">
                  ⚠️ This logo is low resolution for the size it&apos;s being printed at — it may look
                  blurry or pixelated on the finished product.
                </p>
              )}
              {logoPreview && detectedColors.length > 0 && (
                <div className="mt-3 pt-3 border-t border-line">
                  <p className="text-xs text-muted mb-1.5">Colors detected in this logo</p>
                  <div className="flex flex-wrap gap-2">
                    {detectedColors.map((c) => (
                      <span
                        key={c.hex}
                        className="inline-flex items-center gap-1.5 text-[11px] rounded-full border border-line px-2 py-1"
                      >
                        <span
                          className="h-3 w-3 rounded-full border border-line shrink-0"
                          style={{ backgroundColor: c.hex }}
                        />
                        {c.hex.toUpperCase()} · {c.pct}%
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {logoPreview && technique?.singleColorInk && (
                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-line">
                  <input
                    type="color"
                    value={inkColor}
                    onChange={(e) => setInkColor(e.target.value)}
                    className="h-9 w-9 rounded border border-line cursor-pointer p-0 bg-transparent shrink-0"
                    aria-label="Ink color"
                  />
                  <input
                    type="text"
                    value={colorTextInput}
                    onChange={(e) => setColorTextInput(e.target.value)}
                    onBlur={applyColorTextInput}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        applyColorTextInput();
                      }
                    }}
                    placeholder="Pantone or hex"
                    className="h-9 w-32 rounded border border-line px-2 text-xs shrink-0"
                    aria-label="Pantone code or hex color"
                  />
                  <div className="text-xs">
                    <p className="text-muted">
                      Ink color for this technique — {inkColor.toUpperCase()}
                    </p>
                    {pantoneMatch && (
                      <p className="text-muted/80">
                        Closest match: {pantoneMatch.code} (approximate, not an official Pantone
                        conversion)
                      </p>
                    )}
                  </div>
                </div>
              )}
            </CollapsibleSection>
            <CollapsibleSection title="Template frame" optional>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setFrame("")}
                  className={`h-14 w-16 rounded-lg border flex items-center justify-center text-[9px] font-medium shrink-0 ${
                    frame === "" ? "border-dark bg-dark text-cream-light" : "border-line text-muted"
                  }`}
                >
                  None
                </button>
                {FRAME_TEMPLATES.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    title={opt.label}
                    onClick={() => setFrame(opt.id)}
                    className={`h-14 w-16 rounded-lg border flex items-center justify-center shrink-0 ${
                      frame === opt.id ? "border-dark bg-cream" : "border-line"
                    }`}
                  >
                    <svg
                      viewBox="0 0 200 90"
                      width={52}
                      height={23}
                      dangerouslySetInnerHTML={{ __html: frameSvgInner(opt.id, "currentColor") }}
                    />
                  </button>
                ))}
              </div>
            </CollapsibleSection>
            <CollapsibleSection
              title="Your names or event text"
              trailing={nameSizeLabel && <span className="text-xs">{nameSizeLabel}</span>}
            >
              <textarea
                value={names}
                rows={zone?.max_lines ?? 2}
                onChange={(e) => {
                  const maxChars = zone?.max_chars_per_line ?? 24;
                  const maxLines = zone?.max_lines ?? 2;
                  const capped = e.target.value
                    .split("\n")
                    .slice(0, maxLines)
                    .map((line) => line.slice(0, maxChars))
                    .join("\n");
                  setNames(capped);
                }}
                aria-required="true"
                aria-invalid={!namesValid}
                aria-describedby={!namesValid ? namesErrorId : undefined}
                className={`w-full rounded-lg border px-4 py-3 focus:outline-none focus:border-dark mb-1.5 resize-none ${
                  namesValid ? "border-line" : "border-red-500"
                }`}
              />
              <p id={namesErrorId} className="text-xs text-red-600 mb-3 min-h-[1em]">
                {!namesValid && NAMES_REQUIRED_MESSAGE}
              </p>
              <label className="text-xs uppercase tracking-wide text-muted block mb-2">Text font</label>
              <div className="grid grid-cols-2 gap-2">
                {TEXT_FONTS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setTextFont(f.id)}
                    className={`rounded-lg border px-3 py-2 text-left overflow-hidden ${
                      textFont === f.id ? "border-dark bg-cream" : "border-line"
                    }`}
                  >
                    <span className="block text-[9px] uppercase tracking-wide text-muted">{f.label}</span>
                    <span className="block truncate text-lg leading-tight" style={textFontStyle(f.id)}>
                      {names || (isMerchandise ? "Your Company" : "Amelia & Ravi")}
                    </span>
                  </button>
                ))}
              </div>
            </CollapsibleSection>
            <CollapsibleSection
              title="Date"
              trailing={dateSizeLabel && <span className="text-xs">{dateSizeLabel}</span>}
            >
              <div className="relative">
                {/* The native picker stays fully functional (tap to open the
                    calendar, works with a screen reader off its own value),
                    but its own locale-formatted text is hidden — the visible
                    text is always the fixed MM·DD·YYYY format that's what
                    actually gets printed (BUG-08), so what the customer
                    reads here matches the product regardless of browser
                    locale. */}
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  aria-label={formattedDate ? `Date: ${formattedDate}` : "Date"}
                  className="w-full rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark text-transparent caret-transparent [color-scheme:light]"
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-dark"
                >
                  {formattedDate}
                </span>
              </div>
            </CollapsibleSection>
            <CollapsibleSection
              title="Monogram"
              optional
              trailing={monogram && monogramSizeLabel && <span className="text-xs">{monogramSizeLabel}</span>}
            >
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setMonogram("")}
                  className={`h-11 px-3 rounded-lg border flex items-center justify-center text-xs font-medium ${
                    monogram === "" ? "border-dark bg-dark text-cream-light" : "border-line"
                  }`}
                >
                  None
                </button>
                {MONOGRAM_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setMonogram(opt.id)}
                    title={opt.label}
                    className={`h-11 w-11 rounded-lg border flex items-center justify-center ${
                      monogram === opt.id ? "border-dark bg-dark text-cream-light" : "border-line text-dark"
                    }`}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width={18}
                      height={18}
                      dangerouslySetInnerHTML={{ __html: monogramSvgInner(opt.id, "currentColor") }}
                    />
                  </button>
                ))}
              </div>
            </CollapsibleSection>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted">
                Drag any element on the photo to move it. Grab its corner dot to resize, the dot above it to rotate —
                each tilts to match the print area automatically, and can be fine-tuned from there.
              </p>
              <button
                type="button"
                onClick={() => {
                  setPositions(computeDefaultPositions(zone));
                  setElemScale(DEFAULT_SCALES);
                  setElemRotationOffset(DEFAULT_ROTATIONS);
                }}
                className="text-xs text-terracotta-dark font-medium shrink-0 ml-3"
              >
                Reset positions
              </button>
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

        {product.personalizable && product.aiRenderEnabled && (
          <AiRenderPanel
            key={activeZoneId}
            productId={product.id}
            zoneId={zone?.id}
            names={names}
            date={date}
            monogram={monogram}
            frame={frame}
            textFont={textFont}
            logoFile={logoFile}
            positions={positions}
            elemScale={elemScale}
            elemRotationOffset={elemRotationOffset}
            images={product.images}
            defaultImageId={zone?.image_id ?? product.images[0]?.id ?? null}
            unlimited={unlimitedRenders}
            onGenerated={(result) => setLatestRender({ ...result, zoneId: activeZoneId })}
          />
        )}

        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs uppercase tracking-wide text-muted">Quantity</label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => updateQuantity(Math.max(product.minOrder, quantity - product.minOrder))}
                className="h-8 w-8 rounded-full border border-line flex items-center justify-center"
              >
                −
              </button>
              <input
                type="number"
                inputMode="numeric"
                value={quantityInput}
                onChange={(e) => setQuantityInput(e.target.value)}
                onBlur={commitQuantityInput}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
                aria-invalid={quantityBelowMinimum}
                aria-describedby={quantityBelowMinimum ? quantityErrorId : undefined}
                className={`w-16 text-center font-medium rounded-lg border py-1 focus:outline-none focus:border-dark ${
                  quantityBelowMinimum ? "border-red-500" : "border-line"
                }`}
              />
              <button
                onClick={() => updateQuantity(quantity + product.minOrder)}
                className="h-8 w-8 rounded-full border border-line flex items-center justify-center"
              >
                +
              </button>
            </div>
          </div>
          {quantityBelowMinimum && (
            <p id={quantityErrorId} className="text-xs text-red-600 mb-2">
              The minimum order is {product.minOrder} units.
            </p>
          )}
          <div className="flex gap-2 flex-wrap">
            {quickQuantities.map((q) => (
              <button
                key={q}
                onClick={() => updateQuantity(q)}
                className={`px-4 py-2 rounded-full text-sm border flex items-center gap-1.5 ${
                  quantity === q ? "bg-dark text-cream-light border-dark" : "border-line"
                }`}
              >
                {q}
                {q === popularQty && (
                  <span
                    className={`text-[10px] uppercase tracking-wide ${
                      quantity === q ? "text-cream-light/70" : "text-terracotta"
                    }`}
                  >
                    Popular
                  </span>
                )}
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
            disabled={addingToCart || !namesValid || quantityBelowMinimum}
            aria-describedby={
              !namesValid ? namesErrorId : quantityBelowMinimum ? quantityErrorId : undefined
            }
            className="px-6 py-3 rounded-full bg-terracotta text-cream-light text-sm font-medium hover:bg-terracotta-dark transition-colors shrink-0 disabled:opacity-50"
          >
            {addingToCart ? "Adding…" : justAdded ? "Added ✓" : "Add to Cart"}
          </button>
        </div>
        {product.allowSample && (
          <button
            onClick={handleAddSample}
            disabled={addingSample || !namesValid}
            aria-describedby={!namesValid ? namesErrorId : undefined}
            className="w-full mt-3 px-6 py-3 rounded-full border border-line text-sm font-medium hover:border-terracotta hover:text-terracotta transition-colors disabled:opacity-50"
          >
            {addingSample
              ? "Adding…"
              : sampleAdded
                ? "Sample added ✓"
                : `Buy 1 sample — +${formatUSD(SAMPLE_FEE)}`}
          </button>
        )}
        {isMerchandise && (
          <div className="mt-3">
            <QuoteRequestForm
              productId={product.id}
              productName={product.name}
              plannerId={product.plannerId}
              defaultQuantity={quantity}
            />
          </div>
        )}
        <button
          onClick={() => router.push(`/store/${product.plannerSlug}/cart`)}
          className="text-sm text-muted mt-4 hover:text-terracotta"
        >
          View cart →
        </button>
      </div>
    </div>
    </div>
  );
}
