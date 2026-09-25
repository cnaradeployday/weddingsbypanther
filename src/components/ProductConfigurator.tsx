"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { formatUSD, applyMarkup } from "@/lib/format";
import { useCart, type AreaPersonalization } from "@/lib/cart";
import { createClient } from "@/lib/supabase/client";
import { techniqueInkColor } from "@/lib/printTechniqueColors";
import { MONOGRAM_OPTIONS, monogramSvgInner } from "@/lib/monograms";
import { FRAME_TEMPLATES, frameSvgInner } from "@/lib/frameTemplates";
import { DEFAULT_TEXT_FONT, textFontStyle } from "@/lib/textFonts";
import { fitTextFontSize, estimateTextWidth, textLineCount } from "@/lib/textFit";
import { consumePersonalizationHandoff } from "@/lib/personalizationHandoff";
import { isNamesValid, NAMES_REQUIRED_MESSAGE } from "@/lib/personalizationValidation";
import { computeDefaultPositions } from "@/lib/defaultDesignLayout";
import { designStorage, LATEST_VERSION_ID } from "@/lib/designStorage";
import { formatPrintDate } from "@/lib/printDate";
import { parseQuantityInput, isQuantityBelowMinimum } from "@/lib/quantityValidation";
import { dataUrlToBlob } from "@/lib/dataUrl";
import { recolorLogoToSolid, removeLogoBackgroundByMode } from "@/lib/logoRecolor";
import { detectLogoColors, type DetectedColor } from "@/lib/logoColors";
import { estimatePrintDpi, MIN_PRINT_DPI } from "@/lib/logoPrintQuality";
import { nearestPantone, resolveColorInput } from "@/lib/pantoneMatch";
import { leadTimeRange } from "@/lib/leadTime";
import { letterSpacingEm, lineHeightMultiplier, curveTextPath } from "@/lib/textStyle";
import { computeSnap, boxSnapTargets } from "@/lib/snapping";
import { alignHorizontal, alignVertical, type HorizontalAlign, type VerticalAlign } from "@/lib/alignment";
import { useQrSvg } from "@/lib/useQrSvg";
import type { BusinessType } from "@/lib/businessType";
import {
  boundingBox,
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
import { useDesignReducer } from "./customizer/useDesignReducer";
import {
  DEFAULT_SCALES,
  DEFAULT_ROTATIONS,
  DEFAULT_TEXT_STYLE,
  isElemPresent,
  type Design,
  type ElemKey,
  type ElemPos,
} from "./customizer/types";
import { ToolRail, type ToolId } from "./customizer/ToolRail";
import { CanvasControls } from "./customizer/CanvasControls";
import { ContextualToolbar } from "./customizer/ContextualToolbar";
import { LayersPanel } from "./customizer/LayersPanel";
import { TextToolPanel } from "./customizer/TextToolPanel";
import { IconElementPanel } from "./customizer/IconElementPanel";
import { LogoToolPanel } from "./customizer/LogoToolPanel";
import { LogoCropModal } from "./customizer/LogoCropModal";
import { QrToolPanel } from "./customizer/QrToolPanel";
import { useKeyboardShortcuts } from "./customizer/useKeyboardShortcuts";
import { KeyboardShortcutsHelp } from "./customizer/KeyboardShortcutsHelp";

// Approximates how each print technique looks on the manual (non-AI) live
// preview — a plain color swap for printed techniques, plus a debossed
// highlight/shadow pairing for engrave so it reads as cut into the material
// rather than printed on top of it.
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

const SAMPLE_FEE = 50;

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

function makeDefaultDesign(isMerchandise: boolean, zoneForDefaults?: Zone): Design {
  return {
    names: isMerchandise ? "Your Company" : "Amelia & Ravi",
    namesStyle: { ...DEFAULT_TEXT_STYLE },
    textFont: isMerchandise ? "montserrat" : DEFAULT_TEXT_FONT,
    date: isMerchandise ? "" : "2026-06-14",
    dateStyle: { ...DEFAULT_TEXT_STYLE },
    monogram: "",
    monogramColor: "#1a1a1a",
    frame: "",
    frameColor: "#1a1a1a",
    logoFile: null,
    logoPreview: null,
    logoOriginalPreview: null,
    logoRemoveWhiteMode: "all",
    inkColor: "#1a1a1a",
    colorTextInput: "",
    qrUrl: "",
    qrColor: "#1a1a1a",
    positions: computeDefaultPositions(zoneForDefaults),
    elemScale: DEFAULT_SCALES,
    elemRotationOffset: DEFAULT_ROTATIONS,
    elemOrder: ["logo", "monogram", "frame", "names", "date", "qr"],
    locked: {},
    hidden: {},
  };
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
  const primaryZone = product.zones[0];

  // If the customer arrived here by tapping a suggested product on another
  // product's page, pick up the names/date/monogram/logo they'd already
  // entered there instead of starting blank — read once, synchronously, as
  // the initial state itself (not an effect) since sessionStorage is a
  // one-shot read, not a subscription. Cleared as soon as it's read, so it
  // only ever applies right after that click, not on a later unrelated visit.
  const [handoff] = useState(() => consumePersonalizationHandoff());

  const [initialDesign] = useState<Design>(() => {
    const base = makeDefaultDesign(isMerchandise, primaryZone);
    if (!handoff) return base;
    return {
      ...base,
      names: handoff.names || base.names,
      date: handoff.date || base.date,
      monogram: handoff.monogram || base.monogram,
      frame: handoff.frame || base.frame,
      textFont: handoff.textFont || base.textFont,
      logoPreview: handoff.logoDataUrl ?? base.logoPreview,
      positions: handoff.positions ? { ...base.positions, ...handoff.positions } : base.positions,
      elemScale: handoff.elemScale ? { ...base.elemScale, ...handoff.elemScale } : base.elemScale,
      elemRotationOffset: handoff.elemRotationOffset
        ? { ...base.elemRotationOffset, ...handoff.elemRotationOffset }
        : base.elemRotationOffset,
    };
  });

  const { design, setDesign, setDesignCoalescing, replaceDesign, undo, redo, commitGesture, canUndo, canRedo } =
    useDesignReducer(initialDesign);

  // The handoff logo is only a data URL (its File object couldn't survive
  // navigation) — reconstitute it as a real File async so it can still be
  // uploaded on checkout, same as one the customer picked here directly.
  useEffect(() => {
    if (!handoff?.logoDataUrl) return;
    dataUrlToBlob(handoff.logoDataUrl).then((blob) => {
      setDesign((prev) => ({ ...prev, logoFile: new File([blob], "logo.png", { type: blob.type || "image/png" }) }));
    });
    // Mount-only: the handoff itself never changes after the initial read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handoff]);

  const [logoSilhouetteUrl, setLogoSilhouetteUrl] = useState<string | null>(null);
  const [logoVector, setLogoVector] = useState<{ ds: string[]; width: number; height: number } | null>(null);
  const [removingBackground, setRemovingBackground] = useState(false);
  const [logoNaturalSize, setLogoNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [detectedColors, setDetectedColors] = useState<DetectedColor[]>([]);
  const [showCropModal, setShowCropModal] = useState(false);

  // Which tool's panel is open (EDIT-01) and which element is selected on
  // the canvas (EDIT-04) — kept separate from `design` since neither is
  // part of the undoable design itself.
  const [activeTool, setActiveTool] = useState<ToolId | null>(null);
  const [activeElem, setActiveElem] = useState<ElemKey | null>(null);
  // Brief, non-blocking feedback shown near an element's size tag while
  // resizing hits the print area's limit (BUG-10) or a rotation had to
  // shrink the element to keep it inside the print area (BUG-03).
  const [elemNotice, setElemNotice] = useState<{ key: ElemKey; message: string } | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(true);

  // EDIT-03 canvas view state — never part of the undoable design (zoom
  // doesn't change what's printed).
  const [zoomPct, setZoomPct] = useState(100);
  const [guidesOn, setGuidesOn] = useState(true);
  const [gridOn, setGridOn] = useState(false);
  const [snapLines, setSnapLines] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });

  const selectElem = useCallback((key: ElemKey | null) => {
    setActiveElem(key);
    if (key) setActiveTool(key);
  }, []);

  const bringToFront = useCallback((key: ElemKey) => {
    setDesignCoalescing((prev) =>
      prev.elemOrder[prev.elemOrder.length - 1] === key
        ? prev
        : { ...prev, elemOrder: [...prev.elemOrder.filter((k) => k !== key), key] }
    );
  }, [setDesignCoalescing]);

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
  const [quantityInput, setQuantityInput] = useState(String(quantity));
  const updateQuantity = (next: number) => {
    setQuantity(next);
    setQuantityInput(String(next));
  };
  // BUG-09: typing a value below the minimum (or an invalid one) no longer
  // silently snaps to the minimum on blur — it stays exactly as typed, with
  // an inline message and the cart buttons disabled, until corrected.
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

  // Which print area the shopper is currently viewing/personalizing. The
  // primary area is always included in the order; secondary/tertiary ones
  // (selectedExtraZoneIds) are additive add-ons the shopper opts into, each
  // with its own surcharge and its own independent design — switching areas
  // doesn't discard what was configured elsewhere. Not part of the undoable
  // design: switching zones loads a different design (history's "replace"),
  // it isn't itself a design edit.
  const [activeZoneId, setActiveZoneId] = useState(primaryZone?.id ?? "");
  const [selectedExtraZoneIds, setSelectedExtraZoneIds] = useState<Set<string>>(new Set());
  const zoneDesignsRef = useRef<Record<string, Design>>({});
  const zone = product.zones.find((z) => z.id === activeZoneId) ?? primaryZone;
  const zoneImageIndex = zone?.image_id ? product.images.findIndex((i) => i.id === zone.image_id) : -1;
  const [activeImage, setActiveImage] = useState(zoneImageIndex >= 0 ? zoneImageIndex : 0);

  // Switches which print area is active: snapshots the outgoing area's
  // current on-screen design so it isn't lost, then loads the incoming
  // area's own saved design (or a fresh one if this is the first visit to
  // it) and jumps the displayed photo to that area's own reference image.
  const switchActiveZone = useCallback(
    (newZoneId: string) => {
      if (newZoneId === activeZoneId) return;
      zoneDesignsRef.current[activeZoneId] = design;
      const newZone = product.zones.find((z) => z.id === newZoneId);
      const next = zoneDesignsRef.current[newZoneId] ?? makeDefaultDesign(isMerchandise, newZone);
      replaceDesign(next);
      selectElem(null);
      setActiveZoneId(newZoneId);
      const newImageIndex = newZone?.image_id ? product.images.findIndex((img) => img.id === newZone.image_id) : -1;
      setActiveImage(newImageIndex >= 0 ? newImageIndex : 0);
    },
    [activeZoneId, design, isMerchandise, product.images, product.zones, replaceDesign, selectElem]
  );

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
  // the sample design. A handoff from another product's page is a more
  // recent, explicit signal than an old saved draft, so it still takes
  // priority, unchanged from today's behavior — this only restores when
  // there's no handoff.
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
        zoneDesignsRef.current = saved.zones as unknown as Record<string, Design>;
        const activeDesign = saved.zones[resolvedActiveZoneId] as unknown as Design | undefined;
        if (activeDesign) replaceDesign(activeDesign);
        setActiveZoneId(resolvedActiveZoneId);
        setSelectedExtraZoneIds(
          new Set(saved.selectedExtraZoneIds.filter((id) => product.zones.some((z) => z.id === id)))
        );
        if (product.techniques.some((t) => t.id === saved.techniqueId)) setTechniqueId(saved.techniqueId);
        if (product.variants.some((v) => v.id === saved.variantId)) setVariantId(saved.variantId);
        if (Number.isFinite(saved.quantity) && saved.quantity > 0) updateQuantity(saved.quantity);
        const resolvedZone = product.zones.find((z) => z.id === resolvedActiveZoneId);
        const newImageIndex = resolvedZone?.image_id
          ? product.images.findIndex((img) => img.id === resolvedZone.image_id)
          : -1;
        setActiveImage(newImageIndex >= 0 ? newImageIndex : 0);
      }
      hasRestoredRef.current = true;
    });
    return () => {
      cancelled = true;
    };
    // Deliberately mount-only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // BUG-01: saves the current design shortly after each change, debounced
  // so a burst of edits (typing, dragging) writes once, not per keystroke.
  useEffect(() => {
    if (!product.personalizable || !hasRestoredRef.current) return;
    const timeout = setTimeout(() => {
      designStorage.save({
        productId: product.id,
        versionId: LATEST_VERSION_ID,
        updatedAt: Date.now(),
        activeZoneId,
        selectedExtraZoneIds: Array.from(selectedExtraZoneIds),
        techniqueId,
        variantId,
        quantity,
        zones: { ...zoneDesignsRef.current, [activeZoneId]: design } as never,
      });
    }, 600);
    return () => clearTimeout(timeout);
  }, [product.personalizable, product.id, design, activeZoneId, selectedExtraZoneIds, techniqueId, variantId, quantity]);

  const [zoneRef, zoneSize] = useElementSize<HTMLDivElement>();
  const [photoRef, photoSize] = useElementSize<HTMLDivElement>();

  const zoneBox = useMemo(() => (zone ? boundingBox(zone.corners_pct) : null), [zone]);
  const zonePoints = useMemo(() => (zone ? zone.corners_pct.map((c) => `${c.x},${c.y}`).join(" ") : ""), [zone]);

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

  const elemRotationDeg: Record<ElemKey, number> = useMemo(
    () => ({
      logo: autoRotationDeg + design.elemRotationOffset.logo,
      monogram: autoRotationDeg + design.elemRotationOffset.monogram,
      frame: autoRotationDeg + design.elemRotationOffset.frame,
      names: autoRotationDeg + design.elemRotationOffset.names,
      date: autoRotationDeg + design.elemRotationOffset.date,
      qr: autoRotationDeg + design.elemRotationOffset.qr,
    }),
    [autoRotationDeg, design.elemRotationOffset]
  );

  const quadCornersPx = useMemo<Point[] | null>(() => {
    if (!zone || zone.corners_pct.length !== 4 || !photoSize.width || !photoSize.height) return null;
    return zone.corners_pct.map((c) => ({ x: (c.x / 100) * photoSize.width, y: (c.y / 100) * photoSize.height }));
  }, [zone, photoSize.width, photoSize.height]);

  const posToPhotoPx = useCallback(
    (pos: ElemPos): Point | null => {
      if (!zoneBox || !photoSize.width || !photoSize.height) return null;
      const fullPctX = zoneBox.left + (pos.x / 100) * zoneBox.width;
      const fullPctY = zoneBox.top + (pos.y / 100) * zoneBox.height;
      return { x: (fullPctX / 100) * photoSize.width, y: (fullPctY / 100) * photoSize.height };
    },
    [zoneBox, photoSize.width, photoSize.height]
  );

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

  // EDIT-03 snapping: the print area's own center/edge lines, plus every
  // OTHER visible element's center/edge — computed fresh each drag from
  // current on-screen boxes, in the same photo-local px space as dragging.
  const computeSnapTargets = useCallback(
    (excludeKey: ElemKey) => {
      const targetsX: number[] = [];
      const targetsY: number[] = [];
      if (quadCornersPx && quadCornersPx.length === 4) {
        const xs = quadCornersPx.map((c) => c.x);
        const ys = quadCornersPx.map((c) => c.y);
        targetsX.push(...boxSnapTargets(Math.min(...xs), Math.max(...xs)));
        targetsY.push(...boxSnapTargets(Math.min(...ys), Math.max(...ys)));
      }
      for (const key of design.elemOrder) {
        if (key === excludeKey || design.hidden[key] || !isElemPresent(design, key)) continue;
        const box = elemBoxRefs.current[key];
        const center = posToPhotoPx(design.positions[key]);
        if (!box || !center) continue;
        const halfW = box.offsetWidth / 2;
        const halfH = box.offsetHeight / 2;
        targetsX.push(...boxSnapTargets(center.x - halfW, center.x + halfW));
        targetsY.push(...boxSnapTargets(center.y - halfH, center.y + halfH));
      }
      return { targetsX, targetsY };
    },
    [design, posToPhotoPx, quadCornersPx]
  );

  // Lets the customer drag the logo, monogram, frame, names, date, and QR
  // independently within the print area. Listeners stay attached for the
  // component's lifetime and no-op unless a drag is in progress.
  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      const state = dragState.current;
      if (!state) return;
      const candidate: Point = {
        x: state.originPx.x + (e.clientX - state.startX),
        y: state.originPx.y + (e.clientY - state.startY),
      };
      const clamped =
        quadCornersPx && quadCornersPx.length === 4
          ? clampOrientedBoxToQuad(candidate, quadCornersPx, state.halfW, state.halfH, state.rotationRad)
          : candidate;
      if (!zoneBox || !photoSize.width || !photoSize.height) return;
      // EDIT-03: snap the element's center to nearby center/edge lines
      // before converting to a stored position.
      const { targetsX, targetsY } = computeSnapTargets(state.key);
      const snapped = computeSnap(clamped, targetsX, targetsY, 6);
      setSnapLines({ x: snapped.snappedToX, y: snapped.snappedToY });
      const fullPctX = (snapped.x / photoSize.width) * 100;
      const fullPctY = (snapped.y / photoSize.height) * 100;
      const nextPos: ElemPos = {
        x: ((fullPctX - zoneBox.left) / zoneBox.width) * 100,
        y: ((fullPctY - zoneBox.top) / zoneBox.height) * 100,
      };
      setDesignCoalescing((prev) => ({ ...prev, positions: { ...prev.positions, [state.key]: nextPos } }));
    };
    const handleUp = () => {
      if (dragState.current) commitGesture();
      dragState.current = null;
      setSnapLines({ x: null, y: null });
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [quadCornersPx, zoneBox, photoSize.width, photoSize.height, computeSnapTargets, setDesignCoalescing, commitGesture]);

  const startDrag = useCallback(
    (key: ElemKey) => (e: React.PointerEvent) => {
      if (design.locked[key]) return;
      e.preventDefault();
      e.stopPropagation();
      selectElem(key);
      bringToFront(key);
      const box = elemBoxRefs.current[key];
      const originPx = posToPhotoPx(design.positions[key]);
      if (!originPx) return;
      const halfW = box ? box.offsetWidth / 2 : 0;
      const halfH = box ? box.offsetHeight / 2 : 0;
      const rotationRad = (elemRotationDeg[key] * Math.PI) / 180;
      dragState.current = { key, startX: e.clientX, startY: e.clientY, originPx, halfW, halfH, rotationRad };
    },
    [design.locked, design.positions, posToPhotoPx, bringToFront, elemRotationDeg, selectElem]
  );

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
        setElemNotice(uncapped > state.maxScale ? { key: state.key, message: "Max size for this print area" } : null);
        setDesignCoalescing((prev) => ({ ...prev, elemScale: { ...prev.elemScale, [state.key]: next } }));
      } else {
        const angle = (Math.atan2(e.clientY - state.centerY, e.clientX - state.centerX) * 180) / Math.PI;
        const delta = angle - state.startAngle;
        const next = Math.max(-45, Math.min(45, state.startRotation + delta));
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
          setDesignCoalescing((prev) => ({
            ...prev,
            positions: resolvedPos ? { ...prev.positions, [state.key]: resolvedPos } : prev.positions,
            elemScale: { ...prev.elemScale, [state.key]: state.startScale * resolved.scale },
            elemRotationOffset: { ...prev.elemRotationOffset, [state.key]: next },
          }));
          setElemNotice(resolved.resized ? { key: state.key, message: "Resized to fit the print area" } : null);
        } else {
          setDesignCoalescing((prev) => ({ ...prev, elemRotationOffset: { ...prev.elemRotationOffset, [state.key]: next } }));
        }
      }
    };
    const handleUp = () => {
      if (elemAdjustState.current) commitGesture();
      elemAdjustState.current = null;
      setElemNotice(null);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [photoPxToPos, setDesignCoalescing, commitGesture]);

  const mmPerPx = useMemo(() => {
    if (!zone?.width_mm || !zoneSize.width) return null;
    return zone.width_mm / zoneSize.width;
  }, [zone, zoneSize.width]);
  const pxPerMm = mmPerPx ? 1 / mmPerPx : null;

  const textAvailableWidth = useCallback(
    (key: "names" | "date") => {
      const fallback = zoneSize.width * 0.97;
      const origin = posToPhotoPx(design.positions[key]);
      if (!origin || !quadCornersPx) return fallback;
      const theta = (elemRotationDeg[key] * Math.PI) / 180;
      const dir: Point = { x: Math.cos(theta), y: Math.sin(theta) };
      const avail = 2 * availableAlongAxis(origin, dir, quadCornersPx) * 0.98;
      return Number.isFinite(avail) && avail > 0 ? avail : fallback;
    },
    [zoneSize.width, posToPhotoPx, design.positions, quadCornersPx, elemRotationDeg]
  );
  const nameFontPx = fitTextFontSize(
    design.names,
    (pxPerMm ? Math.max(10, Math.min(28, pxPerMm * 5)) : 18) * design.elemScale.names,
    textAvailableWidth("names")
  );
  const monogramFontPx = (pxPerMm ? Math.max(12, Math.min(32, pxPerMm * 6)) : 20) * design.elemScale.monogram;
  const frameFontPx = (pxPerMm ? Math.max(12, Math.min(32, pxPerMm * 6)) : 20) * design.elemScale.frame;
  const formattedDate = useMemo(() => formatPrintDate(design.date), [design.date]);
  const dateFontPx = fitTextFontSize(
    "0000000000",
    (pxPerMm ? Math.max(8, Math.min(14, pxPerMm * 2.4)) : 11) * design.elemScale.date,
    textAvailableWidth("date")
  );
  const qrSizePx = (pxPerMm ? Math.max(20, Math.min(80, pxPerMm * 15)) : 40) * design.elemScale.qr;

  const logoWidthPct = useMemo(() => {
    const fallbackPct = 45 * design.elemScale.logo;
    if (!zone?.width_mm || !zone?.height_mm || !zoneSize.width || !zoneSize.height) return fallbackPct;
    const pxPerMmX = zoneSize.width / zone.width_mm;
    const pxPerMmY = zoneSize.height / zone.height_mm;
    const scale = Math.min(pxPerMmX, pxPerMmY);
    const smallerMm = Math.min(zone.width_mm, zone.height_mm);
    const logoBoxPx = scale * smallerMm * 0.45 * design.elemScale.logo;
    return (logoBoxPx / zoneSize.width) * 100;
  }, [zone, zoneSize.width, zoneSize.height, design.elemScale.logo]);

  const logoWidthMm = useMemo(() => {
    if (!zone?.width_mm || !zone?.height_mm) return null;
    const smallerMm = Math.min(zone.width_mm, zone.height_mm);
    return smallerMm * 0.45 * design.elemScale.logo;
  }, [zone, design.elemScale.logo]);

  const logoPrintDpi = useMemo(() => {
    if (!logoNaturalSize || !logoWidthMm) return null;
    return estimatePrintDpi(logoNaturalSize.width, logoWidthMm);
  }, [logoNaturalSize, logoWidthMm]);
  const logoIsLowRes = logoPrintDpi !== null && logoPrintDpi < MIN_PRINT_DPI;

  const startElemAdjust = useCallback(
    (key: ElemKey, mode: "resize" | "rotate") => (e: React.PointerEvent) => {
      if (design.locked[key]) return;
      e.preventDefault();
      e.stopPropagation();
      const box = elemBoxRefs.current[key];
      if (!box) return;
      const rect = box.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const currentScale = design.elemScale[key] || 1;
      const framePadX = key === "names" && design.frame ? nameFontPx * 1.4 : 0;
      const framePadY = key === "names" && design.frame ? nameFontPx * 0.9 : 0;
      const naturalW = box.offsetWidth + framePadX;
      const naturalH = box.offsetHeight + framePadY;
      const centerPhotoPx = posToPhotoPx(design.positions[key]);
      const rotationRad = (elemRotationDeg[key] * Math.PI) / 180;
      const growthRatio =
        quadCornersPx && centerPhotoPx && naturalW > 0 && naturalH > 0
          ? maxOrientedBoxScale(centerPhotoPx, quadCornersPx, naturalW / 2, naturalH / 2, rotationRad)
          : null;
      const maxScale =
        growthRatio != null && Number.isFinite(growthRatio) ? Math.max(0.3, currentScale * growthRatio * 0.98) : 4;
      elemAdjustState.current = {
        key,
        mode,
        centerX,
        centerY,
        startDist: Math.hypot(e.clientX - centerX, e.clientY - centerY),
        startAngle: (Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180) / Math.PI,
        startScale: currentScale,
        startRotation: design.elemRotationOffset[key],
        maxScale,
        quadCornersPx,
        centerPhotoPx,
        naturalHalfW: naturalW / 2,
        naturalHalfH: naturalH / 2,
        autoRotationDeg,
      };
    },
    [design.locked, design.elemScale, design.frame, design.positions, design.elemRotationOffset, elemRotationDeg, nameFontPx, posToPhotoPx, quadCornersPx, autoRotationDeg]
  );

  const technique = product.techniques.find((t) => t.id === techniqueId);
  const variant = product.variants.find((v) => v.id === variantId);

  const singleColorFillMode = technique?.singleColorInk ? technique.singleColorFillMode ?? "silhouette" : null;
  const pantoneMatch = useMemo(
    () => (technique?.singleColorInk ? nearestPantone(design.inkColor) : null),
    [technique?.singleColorInk, design.inkColor]
  );
  // Under a single-color-ink technique, one ink prints/etches everything —
  // every element shares the same customer-chosen color, offered as the
  // sole allowed color rather than letting each element diverge.
  const singleAllowedColor = technique?.singleColorInk ? [design.inkColor] : undefined;
  const effectiveNamesColor = technique?.singleColorInk ? design.inkColor : design.namesStyle.color;
  const effectiveDateColor = technique?.singleColorInk ? design.inkColor : design.dateStyle.color;
  const effectiveMonogramColor = technique?.singleColorInk ? design.inkColor : design.monogramColor;
  const effectiveFrameColor = technique?.singleColorInk ? design.inkColor : design.frameColor;
  const effectiveQrColor = technique?.singleColorInk ? design.inkColor : design.qrColor;
  const applyColorTextInput = useCallback(() => {
    const resolved = resolveColorInput(design.colorTextInput);
    if (resolved) setDesign((prev) => ({ ...prev, inkColor: resolved.hex }));
  }, [design.colorTextInput, setDesign]);

  useEffect(() => {
    if (!design.logoPreview || singleColorFillMode !== "silhouette") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLogoSilhouetteUrl(null);
      return;
    }
    let cancelled = false;
    recolorLogoToSolid(design.logoPreview, design.inkColor)
      .then((url) => {
        if (!cancelled) setLogoSilhouetteUrl(url);
      })
      .catch(() => {
        if (!cancelled) setLogoSilhouetteUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [design.logoPreview, design.inkColor, singleColorFillMode]);

  const effectiveLogoDataUrl =
    singleColorFillMode === "silhouette" && logoSilhouetteUrl ? logoSilhouetteUrl : design.logoPreview;

  useEffect(() => {
    if (!design.logoPreview) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLogoVector(null);
      return;
    }
    let cancelled = false;
    fetch("/api/vectorize-logo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logoDataUrl: design.logoPreview }),
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
  }, [design.logoPreview]);

  useEffect(() => {
    if (!design.logoPreview) {
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
    img.src = design.logoPreview;
    removeLogoBackgroundByMode(design.logoPreview, "background")
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
  }, [design.logoPreview]);

  const handleRemoveWhiteModeChange = async (mode: Design["logoRemoveWhiteMode"]) => {
    const source = design.logoOriginalPreview ?? design.logoPreview;
    if (!source) return;
    setRemovingBackground(true);
    try {
      const result = await removeLogoBackgroundByMode(source, mode);
      const blob = await dataUrlToBlob(result);
      setDesign((prev) => ({
        ...prev,
        logoRemoveWhiteMode: mode,
        logoOriginalPreview: prev.logoOriginalPreview ?? source,
        logoPreview: result,
        logoFile: new File([blob], prev.logoFile?.name ?? "logo.png", { type: blob.type || "image/png" }),
      }));
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

  const sizeLabelWH = (widthPx: number, heightPx: number) =>
    mmPerPx ? `≈ ${((widthPx * mmPerPx) / 10).toFixed(1)}×${((heightPx * mmPerPx) / 10).toFixed(1)} cm` : null;
  const logoWidthPx = zoneSize.width ? (logoWidthPct / 100) * zoneSize.width : 0;
  const nameLineCount = textLineCount(design.names);
  const nameHeightPx = nameFontPx * lineHeightMultiplier(design.namesStyle.lineSpacing) * nameLineCount;
  const nameSizeCm = mmPerPx ? (nameFontPx * mmPerPx) / 10 : null;
  const dateSizeCm = mmPerPx ? (dateFontPx * mmPerPx) / 10 : null;

  const baseQuickQuantities = [product.minOrder, product.minOrder * 2, product.minOrder * 4, product.minOrder * 8];
  const popularQty = product.popularQty && product.popularQty >= product.minOrder ? product.popularQty : null;
  const quickQuantities =
    popularQty && !baseQuickQuantities.includes(popularQty)
      ? [...baseQuickQuantities, popularQty].sort((a, b) => a - b)
      : baseQuickQuantities;

  const handleLogoUpload = async (file: File, dataUrl: string) => {
    setDesign((prev) => ({ ...prev, logoFile: file, logoPreview: dataUrl, logoOriginalPreview: dataUrl }));
    selectElem("logo");
  };
  const handleLogoReplace = async (file: File, dataUrl: string) => {
    setDesign((prev) => ({ ...prev, logoFile: file, logoPreview: dataUrl, logoOriginalPreview: dataUrl }));
  };
  const clearLogo = () => {
    setDesign((prev) => ({ ...prev, logoFile: null, logoPreview: null, logoOriginalPreview: null }));
  };

  const namesValid = !product.personalizable || isNamesValid(design.names);
  const namesErrorId = "names-required-error";
  const quantityErrorId = "quantity-minimum-error";

  const handleAddToCart = () => submitToCart(false);
  const handleAddSample = () => submitToCart(true);

  const buildAreaResult = async (
    client: ReturnType<typeof createClient>,
    uploadBase: string,
    zoneId: string,
    areaDesign: Design,
    precomputedLogoVector?: { ds: string[]; width: number; height: number } | null
  ) => {
    let renderUrl: string | undefined;
    let renderContextUrl: string | undefined;
    if (latestRender && latestRender.zoneId === zoneId) {
      try {
        const productBlob = await dataUrlToBlob(latestRender.imageDataUrl);
        const { error: uploadError } = await client.storage
          .from("personalization-renders")
          .upload(`${uploadBase}-${zoneId}-product.png`, productBlob, { contentType: "image/png" });
        if (!uploadError) {
          renderUrl = client.storage.from("personalization-renders").getPublicUrl(`${uploadBase}-${zoneId}-product.png`)
            .data.publicUrl;
        }
        if (latestRender.contextImageDataUrl) {
          const contextBlob = await dataUrlToBlob(latestRender.contextImageDataUrl);
          const { error: contextError } = await client.storage
            .from("personalization-renders")
            .upload(`${uploadBase}-${zoneId}-context.png`, contextBlob, { contentType: "image/png" });
          if (!contextError) {
            renderContextUrl = client.storage.from("personalization-renders").getPublicUrl(
              `${uploadBase}-${zoneId}-context.png`
            ).data.publicUrl;
          }
        }
      } catch {
        // Best-effort — still add to cart even if the upload fails.
      }
    }

    let snapshotUrl: string | undefined = renderUrl;
    const hasContent = !!(
      areaDesign.names.trim() ||
      areaDesign.date.trim() ||
      areaDesign.monogram.trim() ||
      areaDesign.frame.trim() ||
      areaDesign.qrUrl.trim() ||
      areaDesign.logoFile
    );
    if (!snapshotUrl && product.personalizable && hasContent) {
      try {
        const logoDataUrl =
          areaDesign.logoPreview && singleColorFillMode === "silhouette"
            ? await recolorLogoToSolid(areaDesign.logoPreview, areaDesign.inkColor).catch(() => areaDesign.logoPreview!)
            : areaDesign.logoPreview ?? undefined;
        const zoneRow = product.zones.find((z) => z.id === zoneId);
        const res = await fetch("/api/personalization-snapshot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId: product.id,
            zoneId,
            imageId: zoneRow?.image_id ?? undefined,
            names: areaDesign.names,
            date: areaDesign.date,
            monogram: areaDesign.monogram,
            frame: areaDesign.frame,
            textFont: areaDesign.textFont,
            logoDataUrl,
            positions: areaDesign.positions,
            elemScale: areaDesign.elemScale,
            elemRotationOffsetDeg: areaDesign.elemRotationOffset,
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

    let logoVectorResult = precomputedLogoVector ?? null;
    if (precomputedLogoVector === undefined && areaDesign.logoPreview) {
      try {
        const res = await fetch("/api/vectorize-logo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ logoDataUrl: areaDesign.logoPreview }),
        });
        const json = res.ok ? await res.json() : null;
        logoVectorResult = json && json.ds ? json : null;
      } catch {
        logoVectorResult = null;
      }
    }

    return { renderUrl, renderContextUrl, snapshotUrl, logoVector: logoVectorResult };
  };

  const submitToCart = async (sample: boolean) => {
    if (sample) setAddingSample(true);
    else setAddingToCart(true);

    const client = createClient();
    const uploadBase = `${product.plannerSlug}/${product.id}/${crypto.randomUUID()}`;

    const allDesigns: Record<string, Design> = { ...zoneDesignsRef.current, [activeZoneId]: design };

    const primaryDesign = (primaryZone && allDesigns[primaryZone.id]) ?? design;
    const primaryResult = primaryZone
      ? await buildAreaResult(client, uploadBase, primaryZone.id, primaryDesign, primaryZone.id === activeZoneId ? logoVector : undefined)
      : { renderUrl: undefined, renderContextUrl: undefined, snapshotUrl: undefined, logoVector: null };

    // Hidden elements aren't printed (EDIT-14) — omit their content/color
    // from the cart payload rather than relying on every downstream reader
    // to separately check a `hidden` map.
    const printedContent = (d: Design, key: "names" | "date" | "monogram" | "frame") =>
      d.hidden[key] ? "" : d[key];
    const printedColor = (d: Design, key: "names" | "date" | "monogram" | "frame" | "qr", color: string) =>
      technique?.singleColorInk || d.hidden[key] ? undefined : color;

    const additionalAreas: AreaPersonalization[] = [];
    for (const z of extraAreas) {
      const areaDesign = allDesigns[z.id] ?? makeDefaultDesign(isMerchandise, z);
      const result = await buildAreaResult(client, uploadBase, z.id, areaDesign, z.id === activeZoneId ? logoVector : undefined);
      additionalAreas.push({
        zoneId: z.id,
        label: z.label,
        extraPrice: z.extra_price,
        names: printedContent(areaDesign, "names"),
        date: printedContent(areaDesign, "date"),
        monogram: printedContent(areaDesign, "monogram"),
        frame: printedContent(areaDesign, "frame"),
        textFont: areaDesign.textFont,
        positions: areaDesign.positions,
        elemScale: areaDesign.elemScale,
        elemRotationOffset: areaDesign.elemRotationOffset,
        hasLogo: !!areaDesign.logoFile,
        renderUrl: result.renderUrl,
        snapshotUrl: result.snapshotUrl,
        inkColorHex: technique?.singleColorInk ? areaDesign.inkColor : undefined,
        inkPantoneCode: technique?.singleColorInk ? nearestPantone(areaDesign.inkColor)?.code : undefined,
        namesColor: printedColor(areaDesign, "names", areaDesign.namesStyle.color),
        dateColor: printedColor(areaDesign, "date", areaDesign.dateStyle.color),
        monogramColor: printedColor(areaDesign, "monogram", areaDesign.monogramColor),
        frameColor: printedColor(areaDesign, "frame", areaDesign.frameColor),
        qrUrl: areaDesign.hidden.qr ? undefined : areaDesign.qrUrl || undefined,
        qrColor: printedColor(areaDesign, "qr", areaDesign.qrColor),
        logoVector: result.logoVector,
      });
    }

    const primaryImageIndex = primaryZone?.image_id ? product.images.findIndex((i) => i.id === primaryZone.image_id) : -1;
    const primaryDisplayImage =
      variant?.image_url ?? product.images[primaryImageIndex >= 0 ? primaryImageIndex : 0]?.url ?? product.images[0]?.url;

    const extraKeyPart = extraAreas
      .map((z) => {
        const d = allDesigns[z.id] ?? makeDefaultDesign(isMerchandise, z);
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
            names: printedContent(primaryDesign, "names"),
            date: printedContent(primaryDesign, "date"),
            monogram: printedContent(primaryDesign, "monogram"),
            frame: printedContent(primaryDesign, "frame"),
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
            namesColor: printedColor(primaryDesign, "names", primaryDesign.namesStyle.color),
            dateColor: printedColor(primaryDesign, "date", primaryDesign.dateStyle.color),
            monogramColor: printedColor(primaryDesign, "monogram", primaryDesign.monogramColor),
            frameColor: printedColor(primaryDesign, "frame", primaryDesign.frameColor),
            qrUrl: primaryDesign.hidden.qr ? undefined : primaryDesign.qrUrl || undefined,
            qrColor: printedColor(primaryDesign, "qr", primaryDesign.qrColor),
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

  // EDIT-06 keyboard shortcuts.
  useKeyboardShortcuts({
    activeElem,
    locked: activeElem ? !!design.locked[activeElem] : false,
    onNudge: (dx, dy) => {
      if (!activeElem) return;
      setDesignCoalescing((prev) => ({
        ...prev,
        positions: {
          ...prev.positions,
          [activeElem]: { x: prev.positions[activeElem].x + dx, y: prev.positions[activeElem].y + dy },
        },
      }));
    },
    onDelete: () => {
      if (!activeElem) return;
      removeElement(activeElem);
    },
    onDeselect: () => selectElem(null),
    onUndo: undo,
    onRedo: redo,
  });

  const removeElement = (key: ElemKey) => {
    setDesign((prev) => {
      switch (key) {
        case "logo":
          return { ...prev, logoFile: null, logoPreview: null, logoOriginalPreview: null };
        case "monogram":
          return { ...prev, monogram: "" };
        case "frame":
          return { ...prev, frame: "" };
        case "qr":
          return { ...prev, qrUrl: "" };
        case "date":
          return { ...prev, date: "" };
        case "names":
          return prev; // required, BUG-02 — not removable
      }
    });
    if (key !== "names") selectElem(null);
  };

  const toggleLock = (key: ElemKey) => {
    setDesign((prev) => ({ ...prev, locked: { ...prev.locked, [key]: !prev.locked[key] } }));
  };
  const toggleHide = (key: ElemKey) => {
    setDesign((prev) => ({ ...prev, hidden: { ...prev.hidden, [key]: !prev.hidden[key] } }));
  };

  const availableTools: ToolId[] = product.personalizable
    ? (["names", "logo", "frame", "monogram", "date", "qr", "layers"] as ToolId[])
    : [];

  const qrSvg = useQrSvg(design.qrUrl, effectiveQrColor);

  // Renders the whole editor canvas (photo + guides + grid + elements +
  // contextual toolbar + canvas controls) — used by both the desktop and
  // mobile layout shells below, which only differ in the chrome around it.
  const renderCanvas = () => (
    <div className="flex-1 min-w-0 min-h-0 flex flex-col bg-[#F1ECE3] relative overflow-hidden">
      <div className="flex-1 overflow-auto">
        <div
          className="mx-auto"
          style={{
            width: `${zoomPct}%`,
            maxWidth: zoomPct <= 100 ? "100%" : undefined,
            transition: "width 120ms ease",
          }}
        >
          <div
            ref={photoRef}
            className="relative aspect-[4/5] w-full overflow-hidden"
            onPointerDown={() => selectElem(null)}
          >
            {displayImage && <Image src={displayImage} alt={product.name} fill className="object-cover" priority />}
            {gridOn && (
              <div
                className="absolute inset-0 pointer-events-none opacity-30"
                style={{
                  backgroundImage:
                    "linear-gradient(to right, #6B6259 1px, transparent 1px), linear-gradient(to bottom, #6B6259 1px, transparent 1px)",
                  backgroundSize: "5% 5%",
                }}
                aria-hidden="true"
              />
            )}
            {product.personalizable && zone && showOverlayHere && guidesOn && (
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none">
                <polygon
                  points={zonePoints}
                  fill="none"
                  stroke="rgba(91,46,224,0.7)"
                  strokeWidth={0.5}
                  strokeDasharray="2.4,1.5"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            )}
            {snapLines.x != null && photoSize.width > 0 && (
              <div
                className="absolute top-0 bottom-0 w-px bg-terracotta pointer-events-none"
                style={{ left: `${(snapLines.x / photoSize.width) * 100}%` }}
                aria-hidden="true"
              />
            )}
            {snapLines.y != null && photoSize.height > 0 && (
              <div
                className="absolute left-0 right-0 h-px bg-terracotta pointer-events-none"
                style={{ top: `${(snapLines.y / photoSize.height) * 100}%` }}
                aria-hidden="true"
              />
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
                {design.logoPreview && !design.hidden.logo && (
                  <div
                    ref={setElemBoxRef("logo")}
                    onPointerDown={startDrag("logo")}
                    className={`absolute pointer-events-auto touch-none ${design.locked.logo ? "cursor-default" : "cursor-move"}`}
                    style={{
                      left: `${design.positions.logo.x}%`,
                      top: `${design.positions.logo.y}%`,
                      width: `${logoWidthPct}%`,
                      aspectRatio: "1",
                      zIndex: design.elemOrder.indexOf("logo"),
                      transform: `translate(-50%, -50%) rotate(${elemRotationDeg.logo}deg)`,
                    }}
                  >
                    <div className="relative w-full h-full pointer-events-none">
                      <Image
                        src={effectiveLogoDataUrl ?? design.logoPreview}
                        alt=""
                        fill
                        className="object-contain"
                        style={technique?.stripSourceColor && !technique?.singleColorInk ? { filter: "grayscale(1)" } : undefined}
                        unoptimized
                      />
                    </div>
                    {activeElem === "logo" && !design.locked.logo && (
                      <AdjustHandles onResizeStart={startElemAdjust("logo", "resize")} onRotateStart={startElemAdjust("logo", "rotate")} notice={elemNotice?.key === "logo" ? elemNotice.message : undefined} />
                    )}
                  </div>
                )}
                {design.frame && !design.hidden.frame && (
                  <div
                    ref={setElemBoxRef("frame")}
                    onPointerDown={startDrag("frame")}
                    className={`absolute pointer-events-auto touch-none select-none ${design.locked.frame ? "cursor-default" : "cursor-move"}`}
                    style={{
                      left: `${design.positions.frame.x}%`,
                      top: `${design.positions.frame.y}%`,
                      width: frameFontPx * 5,
                      height: frameFontPx * 2.2,
                      zIndex: design.elemOrder.indexOf("frame"),
                      transform: `translate(-50%, -50%) rotate(${elemRotationDeg.frame}deg)`,
                    }}
                  >
                    <svg
                      viewBox="0 0 200 90"
                      preserveAspectRatio="none"
                      width="100%"
                      height="100%"
                      className="pointer-events-none"
                      dangerouslySetInnerHTML={{ __html: frameSvgInner(design.frame, effectiveFrameColor) }}
                    />
                    {activeElem === "frame" && !design.locked.frame && (
                      <AdjustHandles onResizeStart={startElemAdjust("frame", "resize")} onRotateStart={startElemAdjust("frame", "rotate")} notice={elemNotice?.key === "frame" ? elemNotice.message : undefined} />
                    )}
                  </div>
                )}
                {design.monogram && !design.hidden.monogram && (
                  <div
                    ref={setElemBoxRef("monogram")}
                    onPointerDown={startDrag("monogram")}
                    className={`absolute pointer-events-auto touch-none select-none ${design.locked.monogram ? "cursor-default" : "cursor-move"}`}
                    style={{
                      left: `${design.positions.monogram.x}%`,
                      top: `${design.positions.monogram.y}%`,
                      width: monogramFontPx,
                      height: monogramFontPx,
                      zIndex: design.elemOrder.indexOf("monogram"),
                      transform: `translate(-50%, -50%) rotate(${elemRotationDeg.monogram}deg)`,
                    }}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width={monogramFontPx}
                      height={monogramFontPx}
                      className="pointer-events-none"
                      dangerouslySetInnerHTML={{ __html: monogramSvgInner(design.monogram, effectiveMonogramColor) }}
                    />
                    {activeElem === "monogram" && !design.locked.monogram && (
                      <AdjustHandles onResizeStart={startElemAdjust("monogram", "resize")} onRotateStart={startElemAdjust("monogram", "rotate")} notice={elemNotice?.key === "monogram" ? elemNotice.message : undefined} />
                    )}
                  </div>
                )}
                {design.names && !design.hidden.names && (
                  <div
                    ref={setElemBoxRef("names")}
                    onPointerDown={startDrag("names")}
                    className={`absolute pointer-events-auto touch-none select-none font-serif flex flex-col items-center leading-tight ${design.locked.names ? "cursor-default" : "cursor-move"}`}
                    style={{
                      left: `${design.positions.names.x}%`,
                      top: `${design.positions.names.y}%`,
                      zIndex: design.elemOrder.indexOf("names"),
                      transform: `translate(-50%, -50%) rotate(${elemRotationDeg.names}deg)`,
                      fontSize: nameFontPx,
                      letterSpacing: `${letterSpacingEm(design.namesStyle.letterSpacing)}em`,
                      lineHeight: lineHeightMultiplier(design.namesStyle.lineSpacing),
                      textAlign: design.namesStyle.align,
                      ...textFontStyle(design.textFont),
                      ...techniqueTextStyle(technique?.technique, effectiveNamesColor),
                    }}
                  >
                    <TextLines
                      text={design.names}
                      fontPx={nameFontPx}
                      curve={design.namesStyle.curve}
                      lineHeight={lineHeightMultiplier(design.namesStyle.lineSpacing)}
                    />
                    {activeElem === "names" && !design.locked.names && (
                      <AdjustHandles
                        onResizeStart={startElemAdjust("names", "resize")}
                        onRotateStart={startElemAdjust("names", "rotate")}
                        notice={elemNotice?.key === "names" ? elemNotice.message : undefined}
                        expandBy={design.frame ? { x: nameFontPx * 0.7, y: nameFontPx * 0.45 } : undefined}
                      />
                    )}
                  </div>
                )}
                {design.date && !design.hidden.date && (
                  <div
                    ref={setElemBoxRef("date")}
                    onPointerDown={startDrag("date")}
                    className={`absolute pointer-events-auto touch-none select-none tracking-wide whitespace-nowrap ${design.locked.date ? "cursor-default" : "cursor-move"}`}
                    style={{
                      left: `${design.positions.date.x}%`,
                      top: `${design.positions.date.y}%`,
                      zIndex: design.elemOrder.indexOf("date"),
                      transform: `translate(-50%, -50%) rotate(${elemRotationDeg.date}deg)`,
                      fontSize: dateFontPx,
                      letterSpacing: `${letterSpacingEm(design.dateStyle.letterSpacing)}em`,
                      ...textFontStyle(design.textFont),
                      ...techniqueTextStyle(technique?.technique, effectiveDateColor),
                    }}
                  >
                    <TextLines text={formattedDate} fontPx={dateFontPx} curve={design.dateStyle.curve} lineHeight={1.2} />
                    {activeElem === "date" && !design.locked.date && (
                      <AdjustHandles onResizeStart={startElemAdjust("date", "resize")} onRotateStart={startElemAdjust("date", "rotate")} notice={elemNotice?.key === "date" ? elemNotice.message : undefined} />
                    )}
                  </div>
                )}
                {design.qrUrl && qrSvg && !design.hidden.qr && (
                  <div
                    ref={setElemBoxRef("qr")}
                    onPointerDown={startDrag("qr")}
                    className={`absolute pointer-events-auto touch-none select-none ${design.locked.qr ? "cursor-default" : "cursor-move"}`}
                    style={{
                      left: `${design.positions.qr.x}%`,
                      top: `${design.positions.qr.y}%`,
                      width: qrSizePx,
                      height: qrSizePx,
                      zIndex: design.elemOrder.indexOf("qr"),
                      transform: `translate(-50%, -50%) rotate(${elemRotationDeg.qr}deg)`,
                      background: "#fff",
                    }}
                    dangerouslySetInnerHTML={{ __html: qrSvg }}
                  >
                    {activeElem === "qr" && !design.locked.qr && (
                      <AdjustHandles onResizeStart={startElemAdjust("qr", "resize")} onRotateStart={startElemAdjust("qr", "rotate")} notice={elemNotice?.key === "qr" ? elemNotice.message : undefined} />
                    )}
                  </div>
                )}
                {activeElem &&
                  (() => {
                    const toolbar = renderContextualToolbarFor(activeElem);
                    if (!toolbar) return null;
                    return (
                      <div
                        className="absolute z-20 pointer-events-auto"
                        style={{
                          left: `${design.positions[activeElem].x}%`,
                          top: `${design.positions[activeElem].y}%`,
                          transform: "translate(-50%, calc(-100% - 28px))",
                        }}
                      >
                        {toolbar}
                      </div>
                    );
                  })()}
              </div>
            )}
            <span className="absolute bottom-3 left-3 text-[11px] bg-cream-light/90 px-3 py-1 rounded-full flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-sage" /> Live preview
            </span>
          </div>
        </div>
      </div>
      {activeElem && mmPerPx && (
        <div className="absolute top-3 right-3 text-[11px] bg-dark text-cream-light px-2.5 py-1 rounded-full pointer-events-none">
          {activeElem === "names" && sizeLabelWH(estimateTextWidth(design.names, nameFontPx), nameHeightPx)}
          {activeElem === "date" && sizeLabelWH(estimateTextWidth("0000000000", dateFontPx), dateFontPx)}
          {activeElem === "monogram" && sizeLabelWH(monogramFontPx, monogramFontPx)}
          {activeElem === "frame" && sizeLabelWH(frameFontPx * 5, frameFontPx * 2.2)}
          {activeElem === "logo" && sizeLabelWH(logoWidthPx, logoWidthPx)}
          {activeElem === "qr" && sizeLabelWH(qrSizePx, qrSizePx)}
        </div>
      )}
      <div className="p-3 flex items-center justify-between gap-3 flex-wrap bg-white border-t border-line">
        <CanvasControls
          zoomPct={zoomPct}
          onZoomChange={setZoomPct}
          onFit={() => setZoomPct(100)}
          guidesOn={guidesOn}
          onToggleGuides={() => setGuidesOn((g) => !g)}
          gridOn={gridOn}
          onToggleGrid={() => setGridOn((g) => !g)}
        />
        <button
          type="button"
          onClick={() => {
            setDesign((prev) => ({
              ...prev,
              positions: computeDefaultPositions(zone),
              elemScale: DEFAULT_SCALES,
              elemRotationOffset: DEFAULT_ROTATIONS,
            }));
          }}
          className="text-xs text-terracotta-dark font-medium"
        >
          Reset positions
        </button>
      </div>
    </div>
  );

  const renderContextualToolbarFor = (key: ElemKey) => {
    if (!isElemPresent(design, key) || design.locked[key]) return null;
    const colorFor: Record<ElemKey, string> = {
      names: effectiveNamesColor,
      date: effectiveDateColor,
      monogram: effectiveMonogramColor,
      frame: effectiveFrameColor,
      logo: "#000000",
      qr: effectiveQrColor,
    };
    const setColorFor = (hex: string) => {
      switch (key) {
        case "names":
          setDesign((prev) => ({ ...prev, namesStyle: { ...prev.namesStyle, color: hex } }));
          break;
        case "date":
          setDesign((prev) => ({ ...prev, dateStyle: { ...prev.dateStyle, color: hex } }));
          break;
        case "monogram":
          setDesign((prev) => ({ ...prev, monogramColor: hex }));
          break;
        case "frame":
          setDesign((prev) => ({ ...prev, frameColor: hex }));
          break;
        case "qr":
          setDesign((prev) => ({ ...prev, qrColor: hex }));
          break;
        case "logo":
          break;
      }
    };
    return (
      <ContextualToolbar
        elemType={key}
        rotationDeg={design.elemRotationOffset[key]}
        color={colorFor[key]}
        colorEditable={key !== "logo"}
        onChangeColor={setColorFor}
        onChangeRotation={(deg) => {
          setDesign((prev) => ({ ...prev, elemRotationOffset: { ...prev.elemRotationOffset, [key]: deg } }));
        }}
        onAlign={(axis, align) => {
          const box = elemBoxRefs.current[key];
          const halfWPct = box && zoneSize.width ? (box.offsetWidth / 2 / zoneSize.width) * 100 : 5;
          const halfHPct = box && zoneSize.height ? (box.offsetHeight / 2 / zoneSize.height) * 100 : 5;
          setDesign((prev) => ({
            ...prev,
            positions: {
              ...prev.positions,
              [key]:
                axis === "horizontal"
                  ? { ...prev.positions[key], x: alignHorizontal(align as HorizontalAlign, halfWPct) }
                  : { ...prev.positions[key], y: alignVertical(align as VerticalAlign, halfHPct) },
            },
          }));
        }}
        deletable={key !== "names"}
        onDelete={() => removeElement(key)}
      />
    );
  };

  return (
    <div className="mx-auto max-w-[1600px] px-3 md:px-6 py-4 md:py-6">
      {showCropModal && design.logoPreview && (
        <LogoCropModal
          preview={design.logoPreview}
          onCancel={() => setShowCropModal(false)}
          onConfirm={async (cropped) => {
            const blob = await dataUrlToBlob(cropped);
            setDesign((prev) => ({
              ...prev,
              logoPreview: cropped,
              logoFile: new File([blob], prev.logoFile?.name ?? "logo.png", { type: blob.type || "image/png" }),
            }));
            setShowCropModal(false);
          }}
        />
      )}

      {product.personalizable ? (
        <div className="flex flex-col border border-line rounded-2xl overflow-hidden bg-white">
          {/* Top bar (EDIT-01) */}
          <header className="h-16 shrink-0 flex items-center justify-between gap-3 px-4 border-b border-line bg-white">
            <div className="flex flex-col min-w-0">
              <span className="font-serif text-lg leading-tight truncate">{product.name}</span>
              <span className="text-xs text-muted truncate">
                {product.categoryName} · {product.supplierName}
              </span>
            </div>
            <div className="hidden md:flex items-center gap-2 text-xs text-[#2E6B47]">
              <span className="h-2 w-2 rounded-full bg-[#2E7D4F]" />
              Saved
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={undo}
                disabled={!canUndo}
                aria-label="Undo"
                className="h-11 w-11 rounded-lg border border-line flex items-center justify-center disabled:opacity-40"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 14L4 9l5-5" />
                  <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
                </svg>
              </button>
              <button
                type="button"
                onClick={redo}
                disabled={!canRedo}
                aria-label="Redo"
                className="h-11 w-11 rounded-lg border border-line flex items-center justify-center disabled:opacity-40"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M15 14l5-5-5-5" />
                  <path d="M20 9H10a6 6 0 0 0 0 12h3" />
                </svg>
              </button>
              <KeyboardShortcutsHelp />
              <button
                type="button"
                onClick={() => {
                  setSummaryOpen(true);
                  document.getElementById("summary-panel")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="hidden md:inline-flex h-10 px-4 rounded-lg bg-terracotta text-cream-light text-sm font-medium items-center"
              >
                Review &amp; buy
              </button>
            </div>
          </header>

          {/* Desktop editor body */}
          <div className="hidden md:flex h-[70vh] min-h-[560px]">
            <ToolRail availableTools={availableTools} activeTool={activeTool} onSelectTool={(t) => (t === "layers" ? setActiveTool("layers") : selectElem(t as ElemKey))} />
            <div className="w-[320px] shrink-0 border-r border-line overflow-y-auto p-5">
              {renderToolPanelContent()}
            </div>
            <div className="flex-1 min-w-0 relative flex">
              {renderCanvas()}
            </div>
            <aside aria-label="Views" className="w-[128px] shrink-0 border-l border-line p-3 flex flex-col gap-3 overflow-y-auto">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">Views</span>
              {product.images.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => setActiveImage(i)}
                  className={`p-2 rounded-lg border flex flex-col items-center gap-1.5 text-xs ${
                    i === activeImage ? "border-terracotta bg-cream" : "border-dashed border-line"
                  }`}
                >
                  <span className="relative h-[70px] w-full block">
                    <Image src={img.url} alt="" fill className="object-contain" />
                  </span>
                  {i === 0 ? "Front" : `View ${i + 1}`}
                </button>
              ))}
              {product.zones.length > 1 && (
                <div className="pt-2 border-t border-line flex flex-col gap-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">Print area</span>
                  {product.zones.map((z, i) => {
                    const isPrimary = i === 0;
                    const isActive = z.id === activeZoneId;
                    const isIncluded = isPrimary || selectedExtraZoneIds.has(z.id);
                    return (
                      <button
                        key={z.id}
                        type="button"
                        onClick={() => (isPrimary ? switchActiveZone(z.id) : toggleExtraZone(z.id))}
                        className={`px-2 py-1.5 rounded-lg text-[11px] border text-left ${
                          isActive ? "border-dark bg-cream" : isIncluded ? "border-dark/60" : "border-line"
                        }`}
                      >
                        {z.label}
                        {!isPrimary && (
                          <span className="text-muted ml-1">{isIncluded ? "✓" : z.extra_price > 0 ? `+${formatUSD(z.extra_price)}` : "+"}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </aside>
          </div>

          {/* Mobile editor body (EDIT-02) */}
          <div className="flex md:hidden flex-col">
            <div style={{ height: "50vh" }} className="flex flex-col">
              {renderCanvas()}
            </div>
            {activeTool && (
              <div className="border-t border-line max-h-[45vh] overflow-y-auto p-5">{renderToolPanelContent()}</div>
            )}
            <ToolRail orientation="horizontal" availableTools={availableTools} activeTool={activeTool} onSelectTool={(t) => (t === "layers" ? setActiveTool("layers") : selectElem(t as ElemKey))} />
          </div>
        </div>
      ) : (
        <div className="relative aspect-[4/5] max-w-xl mx-auto rounded-2xl overflow-hidden bg-cream mb-4">
          {displayImage && <Image src={displayImage} alt={product.name} fill className="object-cover" priority />}
        </div>
      )}

      {product.images.length > 1 && !product.personalizable && (
        <div className="flex gap-3 mt-4 justify-center">
          {product.images.map((img, i) => (
            <button key={img.id} onClick={() => setActiveImage(i)} className={`relative h-16 w-16 rounded-lg overflow-hidden border ${i === activeImage ? "border-dark" : "border-line"}`}>
              <Image src={img.url} alt="" fill className="object-cover" />
            </button>
          ))}
        </div>
      )}

      <RelatedProductsRail
        products={relatedProducts}
        base={`/store/${product.plannerSlug}`}
        names={design.names}
        date={design.date}
        monogram={design.monogram}
        logoDataUrl={design.logoPreview}
        frame={design.frame}
        textFont={design.textFont}
        elemScale={design.elemScale}
        positions={design.positions}
        elemRotationOffset={design.elemRotationOffset}
        quantity={quantity}
      />

      {/* Summary panel — technique, AI render, quantity and cart actions
          stay reachable from the editor until 03-purchase-flow.md's Options/
          Review steps exist (that document's own explicit instruction). */}
      <div id="summary-panel" className="mt-8 border border-line rounded-2xl overflow-hidden">
        <button
          type="button"
          onClick={() => setSummaryOpen((o) => !o)}
          className="w-full flex items-center justify-between px-6 py-4 bg-cream"
        >
          <span className="font-serif text-2xl">Technique, quantity &amp; cart</span>
          <span className="text-2xl font-serif">{formatUSD(total)}</span>
        </button>
        {summaryOpen && (
          <div className="p-6 grid md:grid-cols-2 gap-8">
            <div>
              <h1 className="font-serif text-3xl mb-2">{product.name}</h1>
              <p className="text-xl mb-1">
                {formatUSD(unitPriceWithTechnique)} <span className="text-sm text-muted font-normal">per piece · min {product.minOrder}</span>
              </p>
              {productionTime && <p className="text-sm text-muted mb-3">Production time: {productionTime}</p>}
              <p className="text-muted mb-6">{product.description}</p>

              {product.variants.length > 0 && (
                <div className="mb-6">
                  <label className="text-xs uppercase tracking-wide text-muted block mb-2">
                    {product.variants[0]?.sku ? "Option" : "Variant"}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {product.variants.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => setVariantId(v.id)}
                        className={`px-4 py-2 rounded-lg text-sm border text-left ${variantId === v.id ? "border-dark bg-cream" : "border-line"}`}
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

              {product.techniques.length > 0 && (
                <div className="mb-6">
                  <label className="text-xs uppercase tracking-wide text-muted block mb-2">Print technique</label>
                  <div className="grid grid-cols-3 gap-2">
                    {product.techniques.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setTechniqueId(t.id)}
                        className={`rounded-lg border px-3 py-3 text-sm text-left ${techniqueId === t.id ? "border-dark bg-cream" : "border-line"}`}
                      >
                        <span className="block font-medium">{t.technique}</span>
                        <span className="text-xs text-muted">{t.extra_price > 0 ? `+${formatUSD(t.extra_price)}` : "Included"}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {technique?.singleColorInk && (
                <div className="mb-6">
                  <label htmlFor="ink-color-input" className="text-xs uppercase tracking-wide text-muted block mb-2">
                    Ink color
                  </label>
                  <div className="flex items-center gap-2">
                    <label className="h-11 w-11 shrink-0 rounded-lg border border-line p-1 flex" aria-label="Ink color swatch">
                      <input
                        type="color"
                        value={design.inkColor}
                        onChange={(e) => setDesign((prev) => ({ ...prev, inkColor: e.target.value }))}
                        className="w-full h-full border-none p-0 bg-transparent cursor-pointer"
                      />
                    </label>
                    <div className="flex-1 h-11 rounded-lg border border-line flex items-center px-3 gap-1.5">
                      <input
                        id="ink-color-input"
                        type="text"
                        value={design.colorTextInput}
                        placeholder="#1A1A1A or PMS 355 C"
                        onChange={(e) => setDesign((prev) => ({ ...prev, colorTextInput: e.target.value }))}
                        onBlur={applyColorTextInput}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            applyColorTextInput();
                          }
                        }}
                        className="w-full bg-transparent text-sm"
                        aria-label="Hex or Pantone code"
                      />
                    </div>
                  </div>
                  {pantoneMatch && (
                    <p className="text-xs text-muted mt-2">Closest PANTONE match (approximate): {pantoneMatch.code}</p>
                  )}
                  <p className="text-xs text-muted mt-1">This single ink color is used for every element in this design.</p>
                </div>
              )}

              {product.aiRenderEnabled && (
                <AiRenderPanel
                  key={activeZoneId}
                  productId={product.id}
                  zoneId={zone?.id}
                  names={design.names}
                  date={design.date}
                  monogram={design.monogram}
                  frame={design.frame}
                  textFont={design.textFont}
                  logoFile={design.logoFile}
                  positions={design.positions}
                  elemScale={design.elemScale}
                  elemRotationOffset={design.elemRotationOffset}
                  images={product.images}
                  defaultImageId={zone?.image_id ?? product.images[0]?.id ?? null}
                  unlimited={unlimitedRenders}
                  onGenerated={(result) => setLatestRender({ ...result, zoneId: activeZoneId })}
                />
              )}
            </div>

            <div>
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs uppercase tracking-wide text-muted">Quantity</label>
                  <div className="flex items-center gap-3">
                    <button onClick={() => updateQuantity(Math.max(product.minOrder, quantity - product.minOrder))} className="h-8 w-8 rounded-full border border-line flex items-center justify-center">
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
                      className={`w-16 text-center font-medium rounded-lg border py-1 focus:outline-none focus:border-dark ${quantityBelowMinimum ? "border-red-500" : "border-line"}`}
                    />
                    <button onClick={() => updateQuantity(quantity + product.minOrder)} className="h-8 w-8 rounded-full border border-line flex items-center justify-center">
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
                      className={`px-4 py-2 rounded-full text-sm border flex items-center gap-1.5 ${quantity === q ? "bg-dark text-cream-light border-dark" : "border-line"}`}
                    >
                      {q}
                      {q === popularQty && (
                        <span className={`text-[10px] uppercase tracking-wide ${quantity === q ? "text-cream-light/70" : "text-terracotta"}`}>Popular</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {!namesValid && (
                <p id={namesErrorId} className="text-xs text-red-600 mb-3">
                  {NAMES_REQUIRED_MESSAGE}
                </p>
              )}

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
                  aria-describedby={!namesValid ? namesErrorId : quantityBelowMinimum ? quantityErrorId : undefined}
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
                  {addingSample ? "Adding…" : sampleAdded ? "Sample added ✓" : `Buy 1 sample — +${formatUSD(SAMPLE_FEE)}`}
                </button>
              )}
              {isMerchandise && (
                <div className="mt-3">
                  <QuoteRequestForm productId={product.id} productName={product.name} plannerId={product.plannerId} defaultQuantity={quantity} />
                </div>
              )}
              <button onClick={() => router.push(`/store/${product.plannerSlug}/cart`)} className="text-sm text-muted mt-4 hover:text-terracotta">
                View cart →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // Renders whichever tool panel is currently active — a plain function
  // (not extracted to a separate component) so it can freely close over all
  // the design/setDesign/product state above without threading two dozen
  // props through.
  function renderToolPanelContent() {
    if (activeTool === "layers") {
      return (
        <LayersPanel
          design={design}
          activeElem={activeElem}
          onSelect={(k) => selectElem(k)}
          onReorder={(order) => setDesign((prev) => ({ ...prev, elemOrder: order }))}
          onToggleLock={toggleLock}
          onToggleHide={toggleHide}
        />
      );
    }
    if (activeTool === "names") {
      return (
        <TextToolPanel
          title="Text"
          text={design.names}
          onChangeText={(v) => setDesign((prev) => ({ ...prev, names: v }))}
          textEditable
          font={design.textFont}
          onChangeFont={(id) => setDesign((prev) => ({ ...prev, textFont: id }))}
          sizeCm={nameSizeCm}
          onStepSize={(dir) => setDesign((prev) => ({ ...prev, elemScale: { ...prev.elemScale, names: Math.max(0.3, Math.min(4, prev.elemScale.names + dir * 0.05)) } }))}
          style={design.namesStyle}
          onChangeStyle={(style) => setDesign((prev) => ({ ...prev, namesStyle: style }))}
          allowedColors={singleAllowedColor}
          maxChars={zone?.max_chars_per_line ?? 24}
          maxLines={zone?.max_lines ?? 2}
        />
      );
    }
    if (activeTool === "date") {
      return (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="date-tool-input" className="text-xs uppercase tracking-wide text-muted">
              Date
            </label>
            <input
              id="date-tool-input"
              type="date"
              value={design.date}
              onChange={(e) => setDesign((prev) => ({ ...prev, date: e.target.value }))}
              className="w-full rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark"
            />
            <p className="text-xs text-muted">Always printed as {formattedDate || "MM·DD·YYYY"}, regardless of how it&apos;s entered.</p>
          </div>
          {design.date && (
            <TextToolPanel
              title="Date style"
              text={formattedDate}
              textEditable={false}
              font={design.textFont}
              onChangeFont={(id) => setDesign((prev) => ({ ...prev, textFont: id }))}
              sizeCm={dateSizeCm}
              onStepSize={(dir) => setDesign((prev) => ({ ...prev, elemScale: { ...prev.elemScale, date: Math.max(0.3, Math.min(4, prev.elemScale.date + dir * 0.05)) } }))}
              style={design.dateStyle}
              onChangeStyle={(style) => setDesign((prev) => ({ ...prev, dateStyle: style }))}
              allowedColors={singleAllowedColor}
            />
          )}
        </div>
      );
    }
    if (activeTool === "monogram") {
      return (
        <IconElementPanel
          title="Monogram"
          options={MONOGRAM_OPTIONS}
          selectedId={design.monogram}
          onSelect={(id) => {
            setDesign((prev) => ({ ...prev, monogram: id }));
            if (id) selectElem("monogram");
          }}
          renderIcon={(id, color) => <svg viewBox="0 0 24 24" width={18} height={18} dangerouslySetInnerHTML={{ __html: monogramSvgInner(id, color) }} />}
          color={design.monogramColor}
          onChangeColor={(hex) => setDesign((prev) => ({ ...prev, monogramColor: hex }))}
          allowedColors={singleAllowedColor}
        />
      );
    }
    if (activeTool === "frame") {
      return (
        <IconElementPanel
          title="Frame"
          options={FRAME_TEMPLATES}
          selectedId={design.frame}
          onSelect={(id) => {
            setDesign((prev) => ({ ...prev, frame: id }));
            if (id) selectElem("frame");
          }}
          renderIcon={(id, color) => <svg viewBox="0 0 200 90" width={52} height={23} dangerouslySetInnerHTML={{ __html: frameSvgInner(id, color) }} />}
          color={design.frameColor}
          onChangeColor={(hex) => setDesign((prev) => ({ ...prev, frameColor: hex }))}
          allowedColors={singleAllowedColor}
        />
      );
    }
    if (activeTool === "logo") {
      return (
        <LogoToolPanel
          preview={design.logoPreview}
          onUpload={handleLogoUpload}
          onReplace={handleLogoReplace}
          onRemove={clearLogo}
          onCrop={() => setShowCropModal(true)}
          removeWhiteMode={design.logoRemoveWhiteMode}
          onChangeRemoveWhiteMode={handleRemoveWhiteModeChange}
          isLowRes={logoIsLowRes}
          sizeLabel={sizeLabelWH(logoWidthPx, logoWidthPx)}
          detectedColors={detectedColors}
          processing={removingBackground}
        />
      );
    }
    if (activeTool === "qr") {
      return (
        <QrToolPanel
          url={design.qrUrl}
          onChangeUrl={(url) => {
            setDesign((prev) => ({ ...prev, qrUrl: url }));
            if (url) selectElem("qr");
          }}
          color={effectiveQrColor}
          onChangeColor={(hex) => setDesign((prev) => ({ ...prev, qrColor: hex }))}
        />
      );
    }
    return <p className="text-sm text-muted">Pick a tool from the rail to start editing.</p>;
  }
}

// Renders text as either plain stacked lines (curve 0 — the original,
// simplest case) or, for a non-zero curve slider, one small SVG per line
// with the text following a quadratic-bezier arc (EDIT-07's curve slider).
function TextLines({
  text,
  fontPx,
  curve,
  lineHeight,
}: {
  text: string;
  fontPx: number;
  curve: number;
  lineHeight: number;
}) {
  const lines = text.split("\n");
  if (curve === 0) {
    return (
      <>
        {lines.map((line, i) => (
          <span key={i} className="relative whitespace-nowrap">
            {line}
          </span>
        ))}
      </>
    );
  }
  const lineHeightPx = fontPx * lineHeight;
  return (
    <>
      {lines.map((line, i) => {
        const width = estimateTextWidth(line, fontPx) * 1.15;
        const height = lineHeightPx * 1.6;
        const pathId = `curve-path-${i}-${fontPx.toFixed(0)}`;
        return (
          <svg key={i} width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
            <path id={pathId} d={curveTextPath(curve, width, height)} fill="none" stroke="none" />
            <text fontSize={fontPx} fill="currentColor" style={{ fontFamily: "inherit", fontWeight: "inherit" }}>
              <textPath href={`#${pathId}`} startOffset="50%" textAnchor="middle">
                {line}
              </textPath>
            </text>
          </svg>
        );
      })}
    </>
  );
}

// Direct-manipulation resize/rotate handles shared by every element type: a
// handle at each corner scales uniformly from the center, the handle above
// rotates, both tracked from the element's own on-screen center so they
// work regardless of current rotation. Only rendered while that element is
// selected, so the photo stays clean otherwise.
function AdjustHandles({
  onResizeStart,
  onRotateStart,
  notice,
  expandBy,
}: {
  onResizeStart: (e: React.PointerEvent) => void;
  onRotateStart: (e: React.PointerEvent) => void;
  notice?: string;
  // BUG-04: a decorative frame draws further out than the text element it's
  // wrapped around — without this, the dashed selection outline and handles
  // would trace only the plain text's box.
  expandBy?: { x: number; y: number };
}) {
  const expandX = expandBy?.x ?? 0;
  const expandY = expandBy?.y ?? 0;
  const corner =
    "absolute h-5 w-5 flex items-center justify-center rounded-full bg-white border-2 border-terracotta text-terracotta-dark cursor-nwse-resize touch-none pointer-events-auto";
  const cornerOffset = 10 + expandX;
  const cornerOffsetY = 10 + expandY;
  const rotateOffset = 32 + expandY;
  return (
    <>
      <div className="absolute rounded-sm border border-dashed border-terracotta pointer-events-none" style={{ inset: `${-expandY}px ${-expandX}px` }} />
      <div onPointerDown={onResizeStart} className={corner} style={{ left: -cornerOffset, top: -cornerOffsetY }} aria-label="Resize">
        <svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 13 L13 3" />
          <path d="M8.5 3 H13 V7.5" />
          <path d="M7.5 13 H3 V8.5" />
        </svg>
      </div>
      <div onPointerDown={onResizeStart} className={corner} style={{ right: -cornerOffset, top: -cornerOffsetY }} aria-label="Resize">
        <svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 13 L13 3" />
          <path d="M8.5 3 H13 V7.5" />
          <path d="M7.5 13 H3 V8.5" />
        </svg>
      </div>
      <div onPointerDown={onResizeStart} className={corner} style={{ left: -cornerOffset, bottom: -cornerOffsetY }} aria-label="Resize">
        <svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 13 L13 3" />
          <path d="M8.5 3 H13 V7.5" />
          <path d="M7.5 13 H3 V8.5" />
        </svg>
      </div>
      <div onPointerDown={onResizeStart} className={corner} style={{ right: -cornerOffset, bottom: -cornerOffsetY }} aria-label="Resize">
        <svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 13 L13 3" />
          <path d="M8.5 3 H13 V7.5" />
          <path d="M7.5 13 H3 V8.5" />
        </svg>
      </div>
      <div
        onPointerDown={onRotateStart}
        aria-label="Rotate"
        className="absolute left-1/2 h-5 w-5 -translate-x-1/2 flex items-center justify-center rounded-full bg-white border-2 border-terracotta text-terracotta-dark cursor-grab touch-none pointer-events-auto"
        style={{ top: -rotateOffset }}
      >
        <svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M13 8a5 5 0 1 1-1.7-3.75" />
          <path d="M13 2.2v3.6H9.4" />
        </svg>
      </div>
      {notice && (
        <span role="status" className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-dark text-cream-light text-[11px] px-2.5 py-1 pointer-events-none" style={{ top: -rotateOffset - 32 }}>
          {notice}
        </span>
      )}
    </>
  );
}
