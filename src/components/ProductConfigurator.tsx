"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { formatUSD } from "@/lib/format";
import { applyMarkup } from "@/lib/format";
import { useCart } from "@/lib/cart";
import { createClient } from "@/lib/supabase/client";
import { techniqueInkColor } from "@/lib/printTechniqueColors";
import { MONOGRAM_OPTIONS, monogramSvgInner } from "@/lib/monograms";
import { FRAME_TEMPLATES, frameSvgInner } from "@/lib/frameTemplates";
import { TEXT_FONTS, DEFAULT_TEXT_FONT, textFontStyle } from "@/lib/textFonts";
import { fitTextFontSize, estimateTextWidth, textLineCount } from "@/lib/textFit";
import { consumePersonalizationHandoff } from "@/lib/personalizationHandoff";
import { availableAlongAxis, nearestEdgeDistance, clampPointToQuad, type Point } from "@/lib/quadGeometry";
import type { RelatedProduct } from "@/lib/queries";
import { AiRenderPanel } from "./AiRenderPanel";
import { RelatedProductsRail } from "./RelatedProductsRail";

// Approximates how each print technique looks on the manual (non-AI) live
// preview — a plain color swap for printed techniques, plus a debossed
// highlight/shadow pairing for engrave so it reads as cut into the material
// rather than printed on top of it.
// Flat ink color per technique, no drop-shadow/bevel tricks — those read as
// a stray white smudge/halo behind the text more often than they read as
// "engraved," so the manual preview keeps it simple and lets color alone
// carry the technique's look.
function techniqueTextStyle(techniqueName?: string): React.CSSProperties {
  const color = techniqueInkColor(techniqueName);
  const fontWeight = techniqueName === "Laser engrave" || techniqueName === "Foil stamp" ? 500 : techniqueName === "Embroidery" ? 600 : undefined;
  return fontWeight ? { color, fontWeight } : { color };
}

type Technique = {
  id: string;
  technique: string;
  extra_price: number;
  is_default: boolean;
  stripSourceColor?: boolean;
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

function AdjustHandles({
  onResizeStart,
  onRotateStart,
}: {
  onResizeStart: (e: React.PointerEvent) => void;
  onRotateStart: (e: React.PointerEvent) => void;
}) {
  return (
    <>
      <div
        onPointerDown={onResizeStart}
        className="absolute -right-2.5 -bottom-2.5 h-5 w-5 flex items-center justify-center rounded-full bg-white border-2 border-terracotta text-terracotta-dark cursor-nwse-resize touch-none pointer-events-auto"
      >
        <ResizeIcon />
      </div>
      <div
        onPointerDown={onRotateStart}
        className="absolute left-1/2 -top-8 h-5 w-5 -translate-x-1/2 flex items-center justify-center rounded-full bg-white border-2 border-terracotta text-terracotta-dark cursor-grab touch-none pointer-events-auto"
      >
        <RotateIcon />
      </div>
    </>
  );
}

const DEFAULT_POSITIONS: Record<ElemKey, ElemPos> = {
  monogram: { x: 50, y: 15 },
  logo: { x: 50, y: 35 },
  names: { x: 50, y: 65 },
  date: { x: 50, y: 82 },
};

const DEFAULT_SCALES: Record<ElemKey, number> = { logo: 1, monogram: 1, names: 1, date: 1 };
const DEFAULT_ROTATIONS: Record<ElemKey, number> = { logo: 0, monogram: 0, names: 0, date: 0 };

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

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

  // If the customer arrived here by tapping a suggested product on another
  // product's page, pick up the names/date/monogram/logo they'd already
  // entered there instead of starting blank — read once, synchronously, as
  // the initial state itself (not an effect) since sessionStorage is a
  // one-shot read, not a subscription. Cleared as soon as it's read, so it
  // only ever applies right after that click, not on a later unrelated visit.
  const [handoff] = useState(() => consumePersonalizationHandoff());
  const [names, setNames] = useState(handoff?.names || "Amelia & Ravi");
  const [date, setDate] = useState(handoff?.date || "2026-06-14");
  const [monogram, setMonogram] = useState(handoff?.monogram || "");
  const [frame, setFrame] = useState(handoff?.frame || "");
  const [textFont, setTextFont] = useState<string>(handoff?.textFont || DEFAULT_TEXT_FONT);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(handoff?.logoDataUrl ?? null);

  // The handoff logo is only a data URL (its File object couldn't survive
  // navigation) — reconstitute it as a real File async so it can still be
  // uploaded on checkout, same as one the customer picked here directly.
  useEffect(() => {
    if (!handoff?.logoDataUrl) return;
    dataUrlToBlob(handoff.logoDataUrl).then((blob) => {
      setLogoFile(new File([blob], "logo.png", { type: blob.type || "image/png" }));
    });
  }, [handoff]);
  const [positions, setPositions] = useState<Record<ElemKey, ElemPos>>(DEFAULT_POSITIONS);
  // Each element (logo, monogram, names, date) gets its own independent
  // size and rotation, adjusted with on-canvas drag handles right on the
  // element — not shared sliders elsewhere in the page.
  const [elemScale, setElemScale] = useState<Record<ElemKey, number>>(
    handoff?.elemScale ? { ...DEFAULT_SCALES, ...handoff.elemScale } : DEFAULT_SCALES
  );
  const [elemRotationOffset, setElemRotationOffset] = useState<Record<ElemKey, number>>(DEFAULT_ROTATIONS);
  // Resize/rotate handles only show on the element the customer tapped —
  // otherwise the photo stays uncluttered.
  const [activeElem, setActiveElem] = useState<ElemKey | null>(null);
  const dragState = useRef<{
    key: ElemKey;
    startX: number;
    startY: number;
    originPx: Point;
    marginPx: number;
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
  const commitQuantityInput = () => {
    const parsed = Math.round(Number(quantityInput));
    updateQuantity(Number.isFinite(parsed) && parsed > 0 ? Math.max(product.minOrder, parsed) : product.minOrder);
  };
  const [justAdded, setJustAdded] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  const [latestRender, setLatestRender] = useState<{
    imageDataUrl: string;
    contextImageDataUrl: string | null;
  } | null>(null);

  const zone = product.zones[0];
  const zoneImageIndex = zone?.image_id ? product.images.findIndex((i) => i.id === zone.image_id) : -1;
  const [activeImage, setActiveImage] = useState(zoneImageIndex >= 0 ? zoneImageIndex : 0);

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
          ? clampPointToQuad(candidate, quadCornersPx, state.marginPx)
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
      const box = elemBoxRefs.current[key];
      const originPx = posToPhotoPx(positions[key]);
      if (!originPx) return;
      // A single circular margin (the larger of the box's own half-width/
      // half-height) rather than separate X/Y margins — offsetWidth/Height
      // is the element's own untransformed layout size, not the rotated
      // getBoundingClientRect, which once inflated this margin and could
      // pin the element off-center or let it clip the zone edge once
      // rotated to match an angled print area.
      const marginPx = box ? Math.max(box.offsetWidth / 2, box.offsetHeight / 2) : 0;
      dragState.current = { key, startX: e.clientX, startY: e.clientY, originPx, marginPx };
    },
    [positions, posToPhotoPx]
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
        const next = Math.max(0.3, Math.min(state.maxScale, state.startScale * ratio));
        setElemScale((prev) => ({ ...prev, [state.key]: next }));
      } else {
        const angle = (Math.atan2(e.clientY - state.centerY, e.clientX - state.centerX) * 180) / Math.PI;
        const delta = angle - state.startAngle;
        const next = Math.max(-45, Math.min(45, state.startRotation + delta));
        setElemRotationOffset((prev) => ({ ...prev, [state.key]: next }));
      }
    };
    const handleUp = () => {
      elemAdjustState.current = null;
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, []);

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
      // The available room is the distance from the element's *current
      // position* to the nearest edge of the print area's true quad — not
      // the zone's axis-aligned bounding box, which is looser than the
      // real (possibly angled/trapezoidal) boundary drawn in the admin
      // print-area tool, and not just the zone's total width/height either
      // (an element dragged off-center has less room on its near side than
      // the zone's full extent would suggest). A single conservative
      // radius bounds growth in every direction at once — precise enough
      // to reach the true edge, safe enough to never cross it.
      const centerPhotoPx = posToPhotoPx(positions[key]);
      const edgeDist = quadCornersPx && centerPhotoPx ? nearestEdgeDistance(centerPhotoPx, quadCornersPx) : null;
      // A hard ceiling on the *absolute* elemScale value, not a multiplier
      // off whatever the current scale happens to be — currentScale cancels
      // out of this ratio (naturalW/H already reflect it), so this is the
      // one true scale at which the element/frame's larger dimension would
      // exactly reach the nearest true edge from its current position. No
      // flooring at currentScale: if something already exceeds that (e.g.
      // a stale/looser cap from before this fix), the next resize gesture
      // must be allowed to shrink it back down, not just refuse to grow it
      // further.
      const maxScale =
        edgeDist != null && naturalW > 0 && naturalH > 0
          ? Math.max(0.3, (currentScale * (2 * edgeDist * 0.98)) / Math.max(naturalW, naturalH))
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
      };
    },
    [elemScale, elemRotationOffset, frame, nameFontPx, posToPhotoPx, positions, quadCornersPx]
  );

  const technique = product.techniques.find((t) => t.id === techniqueId);
  const variant = product.variants.find((v) => v.id === variantId);

  const basePrice = product.factoryPrice + (variant?.price_delta ?? 0);
  const unitPriceWithVariant = applyMarkup(basePrice, product.markupPct);
  const unitPriceWithTechnique = unitPriceWithVariant + (technique?.extra_price ?? 0);
  const total = unitPriceWithTechnique * quantity;

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

  const formattedDate = useMemo(() => {
    if (!date) return "";
    const d = new Date(date + "T00:00:00");
    if (Number.isNaN(d.getTime())) return date;
    return d
      .toLocaleDateString("en-US", { day: "2-digit", month: "2-digit", year: "numeric" })
      .replace(/\//g, "·");
  }, [date]);

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

  const handleAddToCart = async () => {
    setAddingToCart(true);

    // If the customer generated an AI render for this exact configuration,
    // persist it to storage so it isn't lost once the tab closes — the
    // planner/supplier/admin need to see it later against the real order.
    let renderUrl: string | undefined;
    let renderContextUrl: string | undefined;
    const client = createClient();
    const uploadBase = `${product.plannerSlug}/${product.id}/${crypto.randomUUID()}`;
    if (latestRender) {
      try {
        const productBlob = await dataUrlToBlob(latestRender.imageDataUrl);
        const { error: uploadError } = await client.storage
          .from("personalization-renders")
          .upload(`${uploadBase}-product.png`, productBlob, { contentType: "image/png" });
        if (!uploadError) {
          renderUrl = client.storage.from("personalization-renders").getPublicUrl(`${uploadBase}-product.png`)
            .data.publicUrl;
        }
        if (latestRender.contextImageDataUrl) {
          const contextBlob = await dataUrlToBlob(latestRender.contextImageDataUrl);
          const { error: contextError } = await client.storage
            .from("personalization-renders")
            .upload(`${uploadBase}-context.png`, contextBlob, { contentType: "image/png" });
          if (!contextError) {
            renderContextUrl = client.storage
              .from("personalization-renders")
              .getPublicUrl(`${uploadBase}-context.png`).data.publicUrl;
          }
        }
      } catch {
        // Best-effort — still add to cart even if the upload fails.
      }
    }

    // Always capture a plain (non-AI) snapshot of exactly what the customer
    // configured — photo, text, positions, technique — so the supplier and
    // admin have a visual record even when the customer skipped the
    // optional AI preview. Reuse the AI render if one was already made
    // (it's the same configuration, already uploaded).
    let snapshotUrl: string | undefined = renderUrl;
    const hasPersonalizationContent = !!(names.trim() || date.trim() || monogram.trim() || logoFile);
    if (!snapshotUrl && product.personalizable && zone && hasPersonalizationContent) {
      try {
        const logoDataUrl = logoFile ? await fileToDataUrl(logoFile) : undefined;
        const res = await fetch("/api/personalization-snapshot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId: product.id,
            names,
            date,
            monogram,
            frame,
            textFont,
            logoDataUrl,
            positions,
            elemScale,
            elemRotationOffsetDeg: elemRotationOffset,
          }),
        });
        if (res.ok) {
          const json = await res.json();
          const blob = await dataUrlToBlob(json.imageDataUrl);
          const { error: uploadError } = await client.storage
            .from("personalization-renders")
            .upload(`${uploadBase}-snapshot.png`, blob, { contentType: "image/png" });
          if (!uploadError) {
            snapshotUrl = client.storage.from("personalization-renders").getPublicUrl(`${uploadBase}-snapshot.png`)
              .data.publicUrl;
          }
        }
      } catch {
        // Best-effort — still add to cart even if the snapshot fails.
      }
    }

    addItem({
      key: `${product.id}:${variantId}:${names}:${date}:${monogram}:${frame}:${techniqueId}`,
      productId: product.id,
      slug: product.slug,
      name: variant ? `${product.name} — ${variant.label}` : product.name,
      image: displayImage ?? null,
      unitPrice: unitPriceWithTechnique,
      quantity,
      minOrder: product.minOrder,
      leadTimeMin: product.leadTimeMin,
      leadTimeMax: product.leadTimeMax,
      variantId: variant?.id,
      variantLabel: variant?.label,
      personalization: product.personalizable
        ? {
            names,
            date,
            monogram,
            frame,
            textFont,
            technique: technique?.technique,
            positions,
            elemScale,
            elemRotationOffset,
            hasLogo: !!logoFile,
            renderUrl,
            renderContextUrl,
            snapshotUrl,
          }
        : undefined,
    });
    setAddingToCart(false);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 2000);
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
                    transform: `translate(-50%, -50%) rotate(${elemRotationDeg.logo}deg)`,
                  }}
                >
                  <div className="relative w-full h-full pointer-events-none">
                    <Image
                      src={logoPreview}
                      alt=""
                      fill
                      className="object-contain"
                      style={technique?.stripSourceColor ? { filter: "grayscale(1)" } : undefined}
                      unoptimized
                    />
                  </div>
                  {activeElem === "logo" && (
                    <AdjustHandles
                      onResizeStart={startElemAdjust("logo", "resize")}
                      onRotateStart={startElemAdjust("logo", "rotate")}
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
                    transform: `translate(-50%, -50%) rotate(${elemRotationDeg.monogram}deg)`,
                  }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    width={monogramFontPx}
                    height={monogramFontPx}
                    className="pointer-events-none"
                    dangerouslySetInnerHTML={{
                      __html: monogramSvgInner(monogram, techniqueInkColor(technique?.technique)),
                    }}
                  />
                  {activeElem === "monogram" && (
                    <AdjustHandles
                      onResizeStart={startElemAdjust("monogram", "resize")}
                      onRotateStart={startElemAdjust("monogram", "rotate")}
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
                    transform: `translate(-50%, -50%) rotate(${elemRotationDeg.names}deg)`,
                    fontSize: nameFontPx,
                    ...textFontStyle(textFont),
                    ...techniqueTextStyle(technique?.technique),
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
                        __html: frameSvgInner(frame, techniqueInkColor(technique?.technique)),
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
                    transform: `translate(-50%, -50%) rotate(${elemRotationDeg.date}deg)`,
                    fontSize: dateFontPx,
                    ...textFontStyle(textFont),
                    ...techniqueTextStyle(technique?.technique),
                  }}
                >
                  {formattedDate}
                  {activeElem === "date" && (
                    <AdjustHandles
                      onResizeStart={startElemAdjust("date", "resize")}
                      onRotateStart={startElemAdjust("date", "rotate")}
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
            <CollapsibleSection title="Your logo" optional>
              <div className="flex items-center gap-3">
                <label className="relative h-16 w-16 rounded-lg overflow-hidden border border-line cursor-pointer bg-white shrink-0">
                  {logoPreview ? (
                    <Image src={logoPreview} alt="" fill className="object-contain" unoptimized />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] text-muted text-center px-1">
                      Upload
                    </span>
                  )}
                  <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
                </label>
                {logoPreview && (
                  <button
                    type="button"
                    onClick={clearLogo}
                    className="text-xs text-terracotta-dark font-medium"
                  >
                    Remove
                  </button>
                )}
              </div>
              {logoPreview && logoSizeLabel && <p className="text-xs text-muted mt-1">{logoSizeLabel}</p>}
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
                className="w-full rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark mb-3 resize-none"
              />
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
                      {names || "Amelia & Ravi"}
                    </span>
                  </button>
                ))}
              </div>
            </CollapsibleSection>
            <CollapsibleSection
              title="Date"
              trailing={dateSizeLabel && <span className="text-xs">{dateSizeLabel}</span>}
            >
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark"
              />
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
                  setPositions(DEFAULT_POSITIONS);
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

        {product.personalizable && (
          <AiRenderPanel
            productId={product.id}
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
            onGenerated={setLatestRender}
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
                className="w-16 text-center font-medium rounded-lg border border-line py-1 focus:outline-none focus:border-dark"
              />
              <button
                onClick={() => updateQuantity(quantity + product.minOrder)}
                className="h-8 w-8 rounded-full border border-line flex items-center justify-center"
              >
                +
              </button>
            </div>
          </div>
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
            disabled={addingToCart}
            className="px-6 py-3 rounded-full bg-terracotta text-cream-light text-sm font-medium hover:bg-terracotta-dark transition-colors shrink-0 disabled:opacity-50"
          >
            {addingToCart ? "Adding…" : justAdded ? "Added ✓" : "Add to Cart"}
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
    </div>
  );
}
