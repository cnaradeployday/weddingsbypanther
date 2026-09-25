"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { formatUSD, applyMarkup } from "@/lib/format";
import { useCart, type AreaPersonalization } from "@/lib/cart";
import { createClient } from "@/lib/supabase/client";
import { techniqueInkColor } from "@/lib/printTechniqueColors";
import { MONOGRAM_OPTIONS, monogramSvgInner } from "@/lib/monograms";
import { FRAME_TEMPLATES, frameSvgInner } from "@/lib/frameTemplates";
import { DEFAULT_TEXT_FONT, textFontStyle } from "@/lib/textFonts";
import { fitTextFontSize, estimateTextWidth, textLineCount } from "@/lib/textFit";
import { consumePersonalizationHandoff } from "@/lib/personalizationHandoff";
import { isNamesValid } from "@/lib/personalizationValidation";
import { computeDefaultPositions } from "@/lib/defaultDesignLayout";
import { designStorage, type SavedDesign, type SavedDesignSummary } from "@/lib/designStorage";
import { formatPrintDate } from "@/lib/printDate";
import { parseQuantityInput, isQuantityBelowMinimum } from "@/lib/quantityValidation";
import { dataUrlToBlob } from "@/lib/dataUrl";
import { recolorLogoToSolid, removeLogoBackgroundByMode } from "@/lib/logoRecolor";
import { detectLogoColors, type DetectedColor } from "@/lib/logoColors";
import { estimatePrintDpi, estimateLogoFootprintMm, MIN_PRINT_DPI } from "@/lib/logoPrintQuality";
import { nearestPantone, resolveColorInput } from "@/lib/pantoneMatch";
import { leadTimeRange } from "@/lib/leadTime";
import { letterSpacingEm, lineHeightMultiplier, curveTextPath } from "@/lib/textStyle";
import { computeSnap, boxSnapTargets } from "@/lib/snapping";
import { alignHorizontal, alignVertical, type HorizontalAlign, type VerticalAlign } from "@/lib/alignment";
import { useQrSvg } from "@/lib/useQrSvg";
import { computeValidationIssues } from "@/lib/purchaseFlowValidation";
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
  ELEM_LABELS,
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
import { StepIndicator, MobileStepIndicator, type FlowStep } from "./customizer/StepIndicator";
import { RecoveryModal } from "./customizer/RecoveryModal";
import { PreviewModal, type PreviewPhoto, type PreviewAiRender } from "./customizer/PreviewModal";
import { OptionsStep } from "./customizer/OptionsStep";
import { ReviewStep } from "./customizer/ReviewStep";

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

// How much to amplify the raw mouse-drag gesture for the resize/rotate
// handles — see the comment at their pointermove handler. 1 = the old,
// unamplified 1:1 behavior reported as needing more drag than the screen
// has room for.
const RESIZE_SENSITIVITY = 2.2;
// Still reported as needing "several tries" to rotate at 1.8 — raised
// further rather than guessing this was already enough.
const ROTATE_SENSITIVITY = 3.2;

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
// re-attaches a fresh observer on every mount, including remounts — which
// also makes it safe for the same canvas to mount/unmount across
// 03-purchase-flow.md's Design/Options/Review steps.
function useElementSize<T extends HTMLElement>() {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const observerRef = useRef<ResizeObserver | null>(null);
  // The Design step mounts a desktop AND a mobile copy of the canvas at
  // once (CSS `hidden`/`md:hidden` toggles which one is visible — both are
  // always in the DOM), and both copies use the SAME ref from a single
  // useElementSize() call in the parent. Whichever copy's ref callback
  // fires last used to win, no matter whether it was the hidden one — a
  // hidden element measures 0x0, so the reported size (and anything
  // computed from it, like the zoom "Fit" percentage) could silently end
  // up stuck at zero depending on mount order. Track whether the currently
  // bound element was actually visible, and never let a hidden new mount
  // steal the binding from a visible one that's already attached.
  const boundWasVisible = useRef(false);

  const ref = useCallback((el: T | null) => {
    if (!el) {
      observerRef.current?.disconnect();
      observerRef.current = null;
      boundWasVisible.current = false;
      return;
    }
    const isVisible = el.offsetWidth > 0 || el.offsetHeight > 0;
    if (observerRef.current && boundWasVisible.current && !isVisible) return;
    observerRef.current?.disconnect();
    boundWasVisible.current = isVisible;
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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { addItem } = useCart();
  const isMerchandise = product.businessType === "merchandise";
  const primaryZone = product.zones[0];

  // FLOW-01: the current step lives in the URL (?step=design|options|review)
  // so reloading keeps it and browser back/forward moves between steps —
  // derived straight from the URL rather than duplicated into local state.
  const step = (searchParams.get("step") as FlowStep | null) ?? "design";
  const goToStep = useCallback(
    (next: FlowStep) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("step", next);
      router.push(`${pathname}?${params.toString()}`, { scroll: true });
    },
    [pathname, router, searchParams]
  );
  // Every step the shopper has already visited stays clickable in the step
  // indicator with a check mark (the least presumptuous reading of
  // "completed steps show a check" — this package's own rule is to never
  // invent a stricter definition than the doc gives). Adjusted directly
  // during render (React's own pattern for "state that depends on a prop
  // changing") rather than in an effect, which would cause an extra render.
  const [visitedSteps, setVisitedSteps] = useState<Set<FlowStep>>(() => new Set([step]));
  const [stepTrackedFor, setStepTrackedFor] = useState(step);
  if (step !== stepTrackedFor) {
    setStepTrackedFor(step);
    setVisitedSteps((prev) => new Set(prev).add(step));
  }

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
  // FLOW-06's "Fix in the design" link: which element to badge on the
  // canvas after jumping back from a Review alert. Cleared automatically —
  // it's a transient pointer, not part of the design itself.
  const [badgeElem, setBadgeElem] = useState<ElemKey | null>(null);
  useEffect(() => {
    if (!badgeElem) return;
    const timeout = setTimeout(() => setBadgeElem(null), 6000);
    return () => clearTimeout(timeout);
  }, [badgeElem]);

  // EDIT-03 canvas view state — never part of the undoable design (zoom
  // doesn't change what's printed).
  const [zoomPct, setZoomPct] = useState(100);
  const [canvasScrollRef, canvasScrollSize] = useElementSize<HTMLDivElement>();
  // "Fit" was hardcoded to 100% — the photo wrapper is width:zoomPct% with
  // a fixed aspect-[4/5], so at 100% its height is 1.25x the scroll area's
  // width. Whenever the scroll area is wider than it is tall (any normal
  // desktop panel), that height overflows the visible area and the customer
  // has to scroll to see the bottom of the product — "no se ve toda la
  // foto". A real fit shrinks zoom just enough that BOTH dimensions land
  // inside the current container.
  const fitZoomPct = useCallback(() => {
    const w = canvasScrollSize.width;
    const h = canvasScrollSize.height;
    if (!w || !h) return 100;
    const heightConstrained = ((h / 1.25) / w) * 100;
    return Math.max(20, Math.min(100, Math.floor(heightConstrained)));
  }, [canvasScrollSize.width, canvasScrollSize.height]);
  // Also used as the *default* zoom on load (not just the "Fit" button),
  // per BUG report: the whole product photo should be visible from the
  // start, not only after the customer discovers and clicks Fit.
  const [zoomInitialized, setZoomInitialized] = useState(false);
  useEffect(() => {
    if (zoomInitialized || !canvasScrollSize.width || !canvasScrollSize.height) return;
    // Reacting to the ResizeObserver-backed measurement becoming available,
    // not to React state — same shape as the other one-time "sync once
    // external measurement is ready" effects in this file.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setZoomPct(fitZoomPct());
    setZoomInitialized(true);
  }, [zoomInitialized, canvasScrollSize.width, canvasScrollSize.height, fitZoomPct]);
  const [guidesOn, setGuidesOn] = useState(true);
  const [gridOn, setGridOn] = useState(false);
  const [snapLines, setSnapLines] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });

  const selectElem = useCallback((key: ElemKey | null) => {
    setActiveElem(key);
    if (key) setActiveTool(key);
  }, []);

  const fixInDesign = useCallback(
    (elemKey: string) => {
      goToStep("design");
      selectElem(elemKey as ElemKey);
      setBadgeElem(elemKey as ElemKey);
    },
    [goToStep, selectElem]
  );

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
  // Every AI render generated this visit (not just the latest) — feeds the
  // views rail and the Preview modal (FLOW-05: "Generated images appear in
  // the views rail and in the preview modal").
  const [aiRenders, setAiRenders] = useState<
    { imageDataUrl: string; contextImageDataUrl: string | null; zoneId: string }[]
  >([]);
  const [showAiViewModal, setShowAiViewModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

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

  // FLOW-02: which saved version this session is editing/autosaving to.
  // Null means "not decided yet" — either the recovery modal is pending a
  // choice, or (when there's nothing to recover) a fresh id is minted
  // immediately, silently. Autosave is gated on this being set (below), so
  // nothing is written until the decision is made.
  const [versionId, setVersionId] = useState<string | null>(() =>
    !product.personalizable || handoff ? crypto.randomUUID() : null
  );
  const [recoveryVersions, setRecoveryVersions] = useState<SavedDesignSummary[]>([]);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saving" | "saved">("saved");

  const applyVersion = useCallback(
    (saved: SavedDesign) => {
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
    },
    [product.zones, product.techniques, product.variants, product.images, primaryZone, replaceDesign]
  );

  const handleContinueVersion = useCallback(
    async (chosenVersionId: string) => {
      const saved = await designStorage.load(product.id, chosenVersionId);
      if (saved) applyVersion(saved);
      setVersionId(chosenVersionId);
      setShowRecoveryModal(false);
    },
    [applyVersion, product.id]
  );
  const handleStartNewVersion = useCallback(() => {
    setVersionId(crypto.randomUUID());
    setShowRecoveryModal(false);
  }, []);
  const handleCloseRecoveryModal = useCallback(() => {
    // "Close button: closes the modal and continues with the most recent
    // version" (FLOW-02) — recoveryVersions[0] since list() returns newest
    // first.
    if (recoveryVersions[0]) handleContinueVersion(recoveryVersions[0].versionId);
    else handleStartNewVersion();
  }, [recoveryVersions, handleContinueVersion, handleStartNewVersion]);

  // BUG-01 + FLOW-02: on mount, list every saved version for this product.
  // None → this is a first visit, mint a fresh version id silently (today's
  // behavior). One or more → show the recovery modal instead of silently
  // picking one, so a shopper with several drafts isn't dropped into
  // whichever happens to be newest without being asked. A handoff from
  // another product's page is a more recent, explicit signal than any old
  // saved draft, so it still takes priority, unchanged.
  useEffect(() => {
    // A handoff or a non-personalizable product needs no recovery check at
    // all — handled as part of the initial state below instead, so this
    // effect only ever does async work (listing IndexedDB), never a
    // synchronous setState.
    if (!product.personalizable || handoff) return;
    let cancelled = false;
    designStorage.list(product.id).then((versions) => {
      if (cancelled) return;
      if (versions.length === 0) {
        setVersionId(crypto.randomUUID());
        return;
      }
      setRecoveryVersions(versions);
      setShowRecoveryModal(true);
    });
    return () => {
      cancelled = true;
    };
    // Deliberately mount-only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // BUG-01: saves the current design shortly after each change, debounced
  // so a burst of edits (typing, dragging) writes once, not per keystroke.
  // Gated on `versionId` being decided — nothing is written while the
  // recovery modal is still pending a choice.
  useEffect(() => {
    if (!product.personalizable || !versionId) return;
    // Reflects the debounced autosave's own in-flight status (FLOW-01's
    // "Saving… / Saved" indicator), not something derivable from render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaveStatus("saving");
    const timeout = setTimeout(() => {
      designStorage
        .save({
          productId: product.id,
          versionId,
          updatedAt: Date.now(),
          activeZoneId,
          selectedExtraZoneIds: Array.from(selectedExtraZoneIds),
          techniqueId,
          variantId,
          quantity,
          zones: { ...zoneDesignsRef.current, [activeZoneId]: design } as never,
        })
        .then(() => setSaveStatus("saved"));
    }, 600);
    return () => clearTimeout(timeout);
  }, [product.personalizable, product.id, design, activeZoneId, selectedExtraZoneIds, techniqueId, variantId, quantity, versionId]);

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

  // Mirrors `design` for the drag effect below without being part of its
  // reactive closure — see the note on `setDesignCoalescing`'s stability in
  // useDesignReducer.ts. `computeSnapTargets` needs the *current* design
  // (other elements' positions to snap against), but if it closed over
  // `design` directly it would get a new identity on every dispatch during
  // a drag — many times a second — which, as a dependency of the drag
  // effect below, would force that effect to tear down and re-subscribe
  // its window listeners constantly instead of once per gesture. A plain
  // ref assignment during render keeps it in sync without that churn: it's
  // never read during render, only later inside an event handler.
  const designRef = useRef(design);
  useEffect(() => {
    designRef.current = design;
  }, [design]);

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
      const currentDesign = designRef.current;
      for (const key of currentDesign.elemOrder) {
        if (key === excludeKey || currentDesign.hidden[key] || !isElemPresent(currentDesign, key)) continue;
        const box = elemBoxRefs.current[key];
        const center = posToPhotoPx(currentDesign.positions[key]);
        if (!box || !center) continue;
        const halfW = box.offsetWidth / 2;
        const halfH = box.offsetHeight / 2;
        targetsX.push(...boxSnapTargets(center.x - halfW, center.x + halfW));
        targetsY.push(...boxSnapTargets(center.y - halfH, center.y + halfH));
      }
      return { targetsX, targetsY };
    },
    [posToPhotoPx, quadCornersPx]
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
        const rawRatio = state.startDist > 0 ? dist / state.startDist : 1;
        // A small element (the common case — a logo a few dozen px across
        // on screen) puts its corner handle close to the center, so the
        // raw 1:1 distance ratio needed a mouse drag well beyond the
        // visible canvas to grow it meaningfully ("no me alcanza la
        // pantalla para estirar tanto"). Raising the ratio to a power > 1
        // keeps it anchored at 1 (no movement = no change) while making
        // the same physical drag produce a much bigger size change, in
        // both directions (shrinking stays > 0 since ratio is always
        // positive, unlike a linear amplification which can go negative).
        const ratio = Math.pow(rawRatio, RESIZE_SENSITIVITY);
        const uncapped = state.startScale * ratio;
        const next = Math.max(0.3, Math.min(state.maxScale, uncapped));
        setElemNotice(uncapped > state.maxScale ? { key: state.key, message: "Max size for this print area" } : null);
        setDesignCoalescing((prev) => ({ ...prev, elemScale: { ...prev.elemScale, [state.key]: next } }));
      } else {
        const angle = (Math.atan2(e.clientY - state.centerY, e.clientX - state.centerX) * 180) / Math.PI;
        const rawDelta = angle - state.startAngle;
        // Same complaint, same fix: amplify the angle actually dragged
        // rather than requiring a wide arc for a modest rotation.
        const delta = rawDelta * ROTATE_SENSITIVITY;
        // Any orientation, not just a +/-45deg nudge — matches the range
        // the toolbar's typed degree field already allowed (BUG report:
        // "tengo que poder rotarlo 360"). +/-180 already covers every
        // possible final orientation (190deg and -170deg look identical),
        // it just can't be reached by spinning past 180 in one continuous
        // drag — reversing direction gets there from the other side.
        const next = Math.max(-180, Math.min(180, state.startRotation + delta));
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

  const logoWidthMm = useMemo(
    () => estimateLogoFootprintMm(zone, design.elemScale.logo),
    [zone, design.elemScale.logo]
  );

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

  // EDIT-07/BUG-03 for the size steppers (+/-): unlike the drag-resize
  // handle (startElemAdjust above), the steppers had no containment check
  // at all — repeatedly clicking "+" could grow an element past the print
  // area with nothing capping it. Mirrors startElemAdjust's own maxScale
  // computation (live box measurement, plus BUG-04's frame padding),
  // predicting the footprint the proposed scale would produce from the
  // currently-measured one.
  const stepElemScale = useCallback(
    (key: ElemKey, dir: 1 | -1) => {
      const currentScale = design.elemScale[key] || 1;
      const proposedScale = Math.max(0.3, Math.min(4, currentScale + dir * 0.05));
      const box = elemBoxRefs.current[key];
      const centerPhotoPx = posToPhotoPx(design.positions[key]);
      if (box && quadCornersPx && centerPhotoPx && currentScale > 0) {
        const framePadX = key === "names" && design.frame ? nameFontPx * 1.4 : 0;
        const framePadY = key === "names" && design.frame ? nameFontPx * 0.9 : 0;
        const ratio = proposedScale / currentScale;
        const halfW = ((box.offsetWidth + framePadX) / 2) * ratio;
        const halfH = ((box.offsetHeight + framePadY) / 2) * ratio;
        const rotationRad = (elemRotationDeg[key] * Math.PI) / 180;
        const fitScale = maxOrientedBoxScale(centerPhotoPx, quadCornersPx, halfW, halfH, rotationRad);
        if (Number.isFinite(fitScale) && fitScale < 1) {
          const cappedScale = Math.max(0.3, proposedScale * fitScale * 0.98);
          setDesign((prev) => ({ ...prev, elemScale: { ...prev.elemScale, [key]: cappedScale } }));
          setElemNotice({ key, message: "Max size for this print area" });
          setTimeout(() => setElemNotice((prev) => (prev?.key === key ? null : prev)), 2000);
          return;
        }
      }
      setDesign((prev) => ({ ...prev, elemScale: { ...prev.elemScale, [key]: proposedScale } }));
    },
    [design.elemScale, design.positions, design.frame, quadCornersPx, posToPhotoPx, elemRotationDeg, nameFontPx, setDesign]
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
  const quickQuantities = Array.from(new Set(baseQuickQuantities)).slice(0, 4);
  const popularQty = product.popularQty && product.popularQty >= product.minOrder ? product.popularQty : null;

  const handleLogoUpload = async (file: File, dataUrl: string) => {
    setDesign((prev) => ({ ...prev, logoFile: file, logoPreview: dataUrl, logoOriginalPreview: dataUrl }));
  };
  const handleLogoReplace = async (file: File, dataUrl: string) => {
    setDesign((prev) => ({ ...prev, logoFile: file, logoPreview: dataUrl, logoOriginalPreview: dataUrl }));
  };
  const clearLogo = () => {
    setDesign((prev) => ({ ...prev, logoFile: null, logoPreview: null, logoOriginalPreview: null }));
  };

  const namesValid = !product.personalizable || isNamesValid(design.names);
  const quantityErrorId = "quantity-minimum-error";

  const handleAddToCart = () => submitToCart(false);
  const handleAddSample = () => submitToCart(true);

  const handleAiGenerated = useCallback(
    (result: { imageDataUrl: string; contextImageDataUrl: string | null }) => {
      const entry = { ...result, zoneId: activeZoneId };
      setLatestRender(entry);
      setAiRenders((prev) => [...prev, entry]);
    },
    [activeZoneId]
  );

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
        namesLetterSpacing: areaDesign.namesStyle.letterSpacing,
        namesLineSpacing: areaDesign.namesStyle.lineSpacing,
        namesCurve: areaDesign.namesStyle.curve,
        namesAlign: areaDesign.namesStyle.align,
        dateLetterSpacing: areaDesign.dateStyle.letterSpacing,
        dateCurve: areaDesign.dateStyle.curve,
        dateAlign: areaDesign.dateStyle.align,
        elemOrder: areaDesign.elemOrder,
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
            namesLetterSpacing: primaryDesign.namesStyle.letterSpacing,
            namesLineSpacing: primaryDesign.namesStyle.lineSpacing,
            namesCurve: primaryDesign.namesStyle.curve,
            namesAlign: primaryDesign.namesStyle.align,
            dateLetterSpacing: primaryDesign.dateStyle.letterSpacing,
            dateCurve: primaryDesign.dateStyle.curve,
            dateAlign: primaryDesign.dateStyle.align,
            elemOrder: primaryDesign.elemOrder,
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

  // FLOW-06's validation engine — reuses BUG-02/BUG-09's own checks. See
  // purchaseFlowValidation.ts for why "element outside the print area,"
  // "color not allowed for the technique," and "QR below minimum size"
  // aren't separately re-checked here.
  const [checklist, setChecklistRaw] = useState<{ namesCorrect: boolean; insidePrintArea: boolean; forDesign: Design }>(
    () => ({ namesCorrect: false, insidePrintArea: false, forDesign: design })
  );
  // Derived, not stored: as soon as `design` changes to a new object (any
  // real edit — useDesignReducer always returns a fresh object), the stored
  // checklist no longer matches `forDesign`, so both items read as
  // unconfirmed again — FLOW-06: "If the design changes after the items
  // were checked... the checks are cleared." No effect needed to reset
  // anything; this recomputes every render.
  const checklistCurrent =
    checklist.forDesign === design ? checklist : { namesCorrect: false, insidePrintArea: false, forDesign: design };
  const toggleChecklistItem = (item: "namesCorrect" | "insidePrintArea") => {
    setChecklistRaw((prev) => {
      const base = prev.forDesign === design ? prev : { namesCorrect: false, insidePrintArea: false, forDesign: design };
      return { ...base, [item]: !base[item] };
    });
  };
  const checklistConfirmed = checklistCurrent.namesCorrect && checklistCurrent.insidePrintArea;

  const hiddenPresentElements = (["logo", "monogram", "frame", "names", "date", "qr"] as ElemKey[])
    .filter((k) => design.hidden[k] && isElemPresent(design, k))
    .map((k) => ({ key: k, label: ELEM_LABELS[k] }));

  const validationIssues = computeValidationIssues({
    names: design.names,
    quantityInput,
    minOrder: product.minOrder,
    checklistConfirmed,
    hasLogo: !!design.logoPreview,
    logoIsLowRes,
    hiddenElements: hiddenPresentElements,
  });

  // FLOW-04: every product photo, paired with a server-rendered snapshot
  // request when a print zone maps to it (PreviewModal fetches and caches
  // these lazily) — a photo with no mapping is shown as-is. Computed inside
  // the "Preview" button's click handler (an event handler, not render)
  // since it reads `zoneDesignsRef` — refs may only be read outside of
  // render.
  const [previewPhotos, setPreviewPhotos] = useState<PreviewPhoto[]>([]);
  const openPreviewModal = useCallback(() => {
    const photos: PreviewPhoto[] = product.images.map((img) => {
      // A zone with no image_id (the common case — one photo, one print
      // area) applies to whichever image doesn't have a more specific
      // zone of its own, the same "null = default" rule `showOverlayHere`
      // already uses for the live canvas. Matching only `z.image_id ===
      // img.id` missed that default zone entirely, so the Preview for a
      // product's main photo silently fell back to the untouched photo
      // with nothing composited on it at all — "the preview doesn't
      // match what I see before" for the most common single-zone case.
      const mappedZone = product.zones.find((z) => z.image_id === img.id) ?? product.zones.find((z) => !z.image_id);
      if (!mappedZone) return { id: img.id, url: img.url, snapshotRequest: null };
      const zoneDesign =
        mappedZone.id === activeZoneId ? design : zoneDesignsRef.current[mappedZone.id] ?? makeDefaultDesign(isMerchandise, mappedZone);
      return {
        id: img.id,
        url: img.url,
        snapshotRequest: {
          productId: product.id,
          zoneId: mappedZone.id,
          imageId: img.id,
          names: zoneDesign.names,
          date: zoneDesign.date,
          monogram: zoneDesign.monogram,
          frame: zoneDesign.frame,
          textFont: zoneDesign.textFont,
          logoDataUrl: zoneDesign.logoPreview ?? undefined,
          positions: zoneDesign.positions,
          elemScale: zoneDesign.elemScale,
          elemRotationOffsetDeg: zoneDesign.elemRotationOffset,
        },
      };
    });
    setPreviewPhotos(photos);
    setShowPreviewModal(true);
  }, [product.images, product.zones, product.id, activeZoneId, design, isMerchandise]);
  const previewAiRenders: PreviewAiRender[] = aiRenders.flatMap((r, i) => [
    { label: `AI render ${i + 1} · Product`, url: r.imageDataUrl },
    ...(r.contextImageDataUrl ? [{ label: `AI render ${i + 1} · Wedding context`, url: r.contextImageDataUrl }] : []),
  ]);

  // Renders the whole editor canvas (photo + guides + grid + elements +
  // contextual toolbar + canvas controls) — used by the Design step's
  // desktop/mobile layouts and reused, read-only-in-spirit but not
  // interaction-gated, as the "design always visible" preview on the
  // Options and Review steps (FLOW-03/FLOW-06).
  const renderCanvas = () => (
    <div className="flex-1 min-w-0 min-h-0 flex flex-col bg-[#F1ECE3] relative overflow-hidden">
      <div ref={canvasScrollRef} className="flex-1 overflow-auto">
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
                {/* A plain colored dashed line can disappear against a
                    similarly-toned photo (e.g. a wood-toned coaster) — a
                    wider white halo underneath keeps the outline visible
                    against any product photo. */}
                <polygon points={zonePoints} fill="none" stroke="#FFFFFF" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeOpacity="0.9" />
                <polygon
                  points={zonePoints}
                  fill="none"
                  stroke="#B5471B"
                  strokeWidth="0.4"
                  strokeDasharray="2,1.5"
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
                    className={`absolute touch-none ${design.locked.logo ? "pointer-events-none cursor-default" : "pointer-events-auto cursor-move"}`}
                    style={{
                      left: `${design.positions.logo.x}%`,
                      top: `${design.positions.logo.y}%`,
                      width: `${logoWidthPct}%`,
                      aspectRatio: "1",
                      zIndex: activeElem === "logo" ? 100 : design.elemOrder.indexOf("logo"),
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
                    {badgeElem === "logo" && <ElementBadge />}
                  </div>
                )}
                {design.frame && !design.hidden.frame && (
                  <div
                    ref={setElemBoxRef("frame")}
                    onPointerDown={startDrag("frame")}
                    className={`absolute touch-none select-none ${design.locked.frame ? "pointer-events-none cursor-default" : "pointer-events-auto cursor-move"}`}
                    style={{
                      left: `${design.positions.frame.x}%`,
                      top: `${design.positions.frame.y}%`,
                      width: frameFontPx * 5,
                      height: frameFontPx * 2.2,
                      zIndex: activeElem === "frame" ? 100 : design.elemOrder.indexOf("frame"),
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
                    {badgeElem === "frame" && <ElementBadge />}
                  </div>
                )}
                {design.monogram && !design.hidden.monogram && (
                  <div
                    ref={setElemBoxRef("monogram")}
                    onPointerDown={startDrag("monogram")}
                    className={`absolute touch-none select-none ${design.locked.monogram ? "pointer-events-none cursor-default" : "pointer-events-auto cursor-move"}`}
                    style={{
                      left: `${design.positions.monogram.x}%`,
                      top: `${design.positions.monogram.y}%`,
                      width: monogramFontPx,
                      height: monogramFontPx,
                      zIndex: activeElem === "monogram" ? 100 : design.elemOrder.indexOf("monogram"),
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
                    {badgeElem === "monogram" && <ElementBadge />}
                  </div>
                )}
                {design.names && !design.hidden.names && (
                  <div
                    ref={setElemBoxRef("names")}
                    onPointerDown={startDrag("names")}
                    className={`absolute touch-none select-none font-serif flex flex-col items-center leading-tight ${design.locked.names ? "pointer-events-none cursor-default" : "pointer-events-auto cursor-move"}`}
                    style={{
                      left: `${design.positions.names.x}%`,
                      top: `${design.positions.names.y}%`,
                      zIndex: activeElem === "names" ? 100 : design.elemOrder.indexOf("names"),
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
                    {badgeElem === "names" && <ElementBadge />}
                  </div>
                )}
                {design.date && !design.hidden.date && (
                  <div
                    ref={setElemBoxRef("date")}
                    onPointerDown={startDrag("date")}
                    className={`absolute touch-none select-none tracking-wide whitespace-nowrap ${design.locked.date ? "pointer-events-none cursor-default" : "pointer-events-auto cursor-move"}`}
                    style={{
                      left: `${design.positions.date.x}%`,
                      top: `${design.positions.date.y}%`,
                      zIndex: activeElem === "date" ? 100 : design.elemOrder.indexOf("date"),
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
                    {badgeElem === "date" && <ElementBadge />}
                  </div>
                )}
                {design.qrUrl && qrSvg && !design.hidden.qr && (
                  <div
                    ref={setElemBoxRef("qr")}
                    onPointerDown={startDrag("qr")}
                    className={`absolute touch-none select-none ${design.locked.qr ? "pointer-events-none cursor-default" : "pointer-events-auto cursor-move"}`}
                    style={{
                      left: `${design.positions.qr.x}%`,
                      top: `${design.positions.qr.y}%`,
                      width: qrSizePx,
                      height: qrSizePx,
                      zIndex: activeElem === "qr" ? 100 : design.elemOrder.indexOf("qr"),
                      transform: `translate(-50%, -50%) rotate(${elemRotationDeg.qr}deg)`,
                      background: "#fff",
                    }}
                    dangerouslySetInnerHTML={{ __html: qrSvg }}
                  >
                    {activeElem === "qr" && !design.locked.qr && (
                      <AdjustHandles onResizeStart={startElemAdjust("qr", "resize")} onRotateStart={startElemAdjust("qr", "rotate")} notice={elemNotice?.key === "qr" ? elemNotice.message : undefined} />
                    )}
                    {badgeElem === "qr" && <ElementBadge />}
                  </div>
                )}
                {activeElem &&
                  (() => {
                    const toolbar = renderContextualToolbarFor(activeElem);
                    if (!toolbar) return null;
                    // The fixed "-28px" gap here was measured from the
                    // element's CENTER (design.positions is a center point),
                    // not its actual top edge — for anything taller than
                    // ~56px (a bigger logo, a scaled-up element) that isn't
                    // enough clearance, so the toolbar rendered overlapping
                    // the element/handles instead of floating clearly above
                    // them. Use the element's real measured box (half its
                    // diagonal, so it still clears at any rotation) plus the
                    // rotate handle's own reach instead of a flat constant.
                    const box = elemBoxRefs.current[activeElem];
                    const halfExtentPx = box ? Math.hypot(box.offsetWidth, box.offsetHeight) / 2 : 40;
                    const clearancePx = halfExtentPx + 56;
                    return (
                      <div
                        className="absolute z-20 pointer-events-auto"
                        // Nothing here stopped a pointerdown from bubbling up
                        // to the canvas's own onPointerDown={() =>
                        // selectElem(null)} (it deselects on any background
                        // click). Clicking into the toolbar's rotation-degree
                        // number field triggered exactly that: the element
                        // deselected and the whole toolbar — including the
                        // input the customer was about to type into —
                        // unmounted before focus ever landed, so typing (and
                        // Enter) appeared to do nothing.
                        onPointerDown={(e) => e.stopPropagation()}
                        style={{
                          left: `${design.positions[activeElem].x}%`,
                          top: `${design.positions[activeElem].y}%`,
                          transform: `translate(-50%, calc(-100% - ${clearancePx}px))`,
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
          onFit={() => setZoomPct(fitZoomPct())}
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

      {showRecoveryModal && (
        <RecoveryModal
          versions={recoveryVersions}
          zones={product.zones}
          images={product.images}
          techniques={product.techniques}
          onContinue={handleContinueVersion}
          onStartNew={handleStartNewVersion}
          onClose={handleCloseRecoveryModal}
        />
      )}

      {showPreviewModal && (
        <PreviewModal photos={previewPhotos} aiRenders={previewAiRenders} onClose={() => setShowPreviewModal(false)} />
      )}

      {showAiViewModal && product.aiRenderEnabled && (
        <div role="dialog" aria-modal="true" aria-label="AI render preview" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl overflow-hidden max-h-[85vh] overflow-y-auto">
            <div className="flex justify-end p-2">
              <button
                type="button"
                onClick={() => setShowAiViewModal(false)}
                aria-label="Close"
                className="h-11 w-11 flex items-center justify-center text-lg text-muted"
              >
                ×
              </button>
            </div>
            <div className="px-4 pb-4">
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
                onGenerated={handleAiGenerated}
              />
            </div>
          </div>
        </div>
      )}

      {product.personalizable ? (
        <div className="flex flex-col border border-line rounded-2xl overflow-hidden bg-white">
          {/* Top bar (EDIT-01 / FLOW-01) */}
          <header className="flex flex-col gap-2 shrink-0 px-4 py-3 border-b border-line bg-white md:h-16 md:flex-row md:items-center md:justify-between md:gap-3 md:py-0">
            <div className="flex items-center justify-between gap-3 md:contents">
              <div className="flex flex-col min-w-0">
                <span className="font-serif text-lg leading-tight truncate">{product.name}</span>
                <span className="text-xs text-muted truncate">
                  {product.categoryName} · {product.supplierName}
                </span>
              </div>
              <MobileStepIndicator step={step} />
            </div>
            <StepIndicator step={step} completedSteps={visitedSteps} onSelectStep={goToStep} />
            <div className="hidden md:flex items-center gap-2 text-xs text-[#2E6B47]">
              <span className="h-2 w-2 rounded-full bg-[#2E7D4F]" />
              {saveStatus === "saving" ? "Saving…" : "Saved"}
            </div>
            <div className="flex items-center gap-1.5 shrink-0 justify-end">
              {step === "design" && (
                <>
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
                </>
              )}
              <button
                type="button"
                onClick={openPreviewModal}
                className="h-11 px-4 rounded-lg border border-line text-sm font-medium hover:bg-cream"
              >
                Preview
              </button>
            </div>
          </header>

          {step === "design" && (
            <>
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
                  {product.aiRenderEnabled && (
                    <button
                      type="button"
                      onClick={() => setShowAiViewModal(true)}
                      className="p-2 rounded-lg border border-dashed border-gold flex flex-col items-center gap-1.5 text-xs"
                    >
                      <span className="relative h-[70px] w-full flex items-center justify-center text-gold">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18" />
                        </svg>
                      </span>
                      AI view{aiRenders.length > 0 ? ` (${aiRenders.length})` : ""}
                    </button>
                  )}
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

              <div className="p-4 border-t border-line flex justify-end">
                <button
                  type="button"
                  onClick={() => goToStep("options")}
                  className="px-6 py-3 rounded-full bg-terracotta text-cream-light text-sm font-medium hover:bg-terracotta-dark transition-colors"
                >
                  Next: Options
                </button>
              </div>
            </>
          )}

          {step === "options" && (
            <div className="flex flex-col md:flex-row gap-6 p-4 md:p-6">
              <div className="md:w-1/2 lg:w-3/5 h-[50vh] md:h-[70vh] flex flex-col rounded-xl overflow-hidden border border-line">
                {renderCanvas()}
              </div>
              <div className="md:w-1/2 lg:w-2/5">
                <OptionsStep
                  productName={product.name}
                  productDescription={product.description ?? ""}
                  unitPrice={unitPriceWithTechnique}
                  minOrder={product.minOrder}
                  productionTime={productionTime}
                  variants={product.variants}
                  variantId={variantId}
                  onChangeVariant={setVariantId}
                  markupPct={product.markupPct}
                  techniques={product.techniques}
                  techniqueId={techniqueId}
                  onChangeTechnique={setTechniqueId}
                  inkColorSlot={
                    technique?.singleColorInk ? (
                      <div>
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
                    ) : null
                  }
                  quantity={quantity}
                  quantityInput={quantityInput}
                  onChangeQuantityInput={setQuantityInput}
                  onCommitQuantityInput={commitQuantityInput}
                  quantityBelowMinimum={quantityBelowMinimum}
                  quantityErrorId={quantityErrorId}
                  quickQuantities={quickQuantities}
                  popularQty={popularQty}
                  onSelectQuantity={updateQuantity}
                  allowSample={product.allowSample}
                  total={total}
                  onNext={() => goToStep("review")}
                />
              </div>
            </div>
          )}

          {step === "review" && (
            <div className="flex flex-col md:flex-row gap-6 p-4 md:p-6">
              <div className="md:w-1/2 lg:w-3/5 h-[50vh] md:h-[70vh] flex flex-col rounded-xl overflow-hidden border border-line">
                {renderCanvas()}
              </div>
              <div className="md:w-1/2 lg:w-2/5">
                <ReviewStep
                  issues={validationIssues}
                  onFixInDesign={fixInDesign}
                  checklist={{ namesCorrect: checklistCurrent.namesCorrect, insidePrintArea: checklistCurrent.insidePrintArea }}
                  onToggleChecklistItem={toggleChecklistItem}
                  technique={technique?.technique ?? null}
                  quantity={quantity}
                  productionTime={productionTime}
                  total={total}
                  unitPrice={unitPriceWithTechnique}
                  allowSample={product.allowSample}
                  sampleFee={SAMPLE_FEE}
                  namesValid={namesValid}
                  quantityBelowMinimum={quantityBelowMinimum}
                  addingToCart={addingToCart}
                  justAdded={justAdded}
                  addingSample={addingSample}
                  sampleAdded={sampleAdded}
                  onAddToCart={handleAddToCart}
                  onAddSample={handleAddSample}
                  aiRenderSlot={
                    product.aiRenderEnabled ? (
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
                        onGenerated={handleAiGenerated}
                      />
                    ) : null
                  }
                />
                {isMerchandise && (
                  <div className="mt-6">
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

      {/* FLOW-08: kept on the product page, not inside the Design step's
          full-editor surface. */}
      {(!product.personalizable || step !== "design") && (
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
      )}
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
          onStepSize={(dir) => stepElemScale("names", dir)}
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
              onStepSize={(dir) => stepElemScale("date", dir)}
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

// FLOW-06's "fix in the design" badge — a brief on-canvas marker for the
// element a Review alert pointed at.
function ElementBadge() {
  return (
    <span
      aria-hidden="true"
      className="absolute -top-2.5 -right-2.5 z-30 h-6 w-6 rounded-full bg-terracotta text-cream-light text-xs font-bold flex items-center justify-center border-2 border-white pointer-events-none animate-pulse"
    >
      !
    </span>
  );
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
