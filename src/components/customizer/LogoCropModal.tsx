"use client";

import { useCallback, useRef, useState } from "react";
import { clampCropRect, cropImageDataUrl, type CropRect } from "@/lib/cropImage";

type Corner = "tl" | "tr" | "bl" | "br";

// EDIT-11's "Crop": a crop frame with drag handles over the logo. Kept
// intentionally simple — move the frame by dragging inside it, resize from
// a corner handle — rather than a full-featured cropper library, since the
// only requirement is "crop frame with handles."
export function LogoCropModal({
  preview,
  onCancel,
  onConfirm,
}: {
  preview: string;
  onCancel: () => void;
  onConfirm: (croppedDataUrl: string) => void;
}) {
  const [rect, setRect] = useState<CropRect>({ x: 0.1, y: 0.1, width: 0.8, height: 0.8 });
  const [busy, setBusy] = useState(false);
  // "mira como mande a cropear y como quedo, hay bug" — the frame below
  // used to be a hardcoded square (aspectRatio: "1") no matter the logo's
  // own shape, with the image fit inside it via object-contain. For
  // anything but a literally square logo, object-contain letterboxes —
  // leaves empty bands on one axis — so the frame's own 0-1 fractions (what
  // the drag handles above read/write) stop lining up with the same
  // fraction of the actual image content once you account for that empty
  // space. cropRectToPixels (cropImage.ts) maps those fractions straight
  // onto the source image's real pixel bounds with no knowledge of any
  // letterbox, so a selection drawn against the square frame crops a
  // shifted/wrong-scale slice of a non-square logo (here, a wide banner —
  // the selection looked centered on the text, but the actual crop reached
  // outside the image's real displayed bounds on the letterboxed axis).
  // Sizing the frame to the image's own aspect ratio means object-contain
  // never letterboxes it — frame fractions and image fractions become the
  // same thing again, for any logo shape.
  const [naturalAspect, setNaturalAspect] = useState(1);
  const frameRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ mode: "move"; startX: number; startY: number; startRect: CropRect } | null>(null);
  // Only the bottom-right corner had a handle at all — "la herramienta
  // Crop tiene que permitir cropear desde los 4 ángulos." Each corner now
  // drags that corner specifically while the OPPOSITE corner stays put as
  // an anchor, so the selection can be resized from (and flipped across)
  // any edge, the standard cropper convention.
  const resizeState = useRef<{ anchor: { x: number; y: number } } | null>(null);

  const startMove = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragState.current = { mode: "move", startX: e.clientX, startY: e.clientY, startRect: rect };
      const onMove = (ev: PointerEvent) => {
        const state = dragState.current;
        const frame = frameRef.current;
        if (!state || !frame) return;
        const box = frame.getBoundingClientRect();
        const dxFrac = (ev.clientX - state.startX) / box.width;
        const dyFrac = (ev.clientY - state.startY) / box.height;
        setRect(clampCropRect({ ...state.startRect, x: state.startRect.x + dxFrac, y: state.startRect.y + dyFrac }));
      };
      const onUp = () => {
        dragState.current = null;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [rect]
  );

  const startResize = useCallback(
    (corner: Corner) => (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const anchor = {
        x: corner === "tl" || corner === "bl" ? rect.x + rect.width : rect.x,
        y: corner === "tl" || corner === "tr" ? rect.y + rect.height : rect.y,
      };
      resizeState.current = { anchor };
      const onMove = (ev: PointerEvent) => {
        const state = resizeState.current;
        const frame = frameRef.current;
        if (!state || !frame) return;
        const box = frame.getBoundingClientRect();
        const pointerFracX = (ev.clientX - box.left) / box.width;
        const pointerFracY = (ev.clientY - box.top) / box.height;
        setRect(
          clampCropRect({
            x: Math.min(pointerFracX, state.anchor.x),
            y: Math.min(pointerFracY, state.anchor.y),
            width: Math.abs(pointerFracX - state.anchor.x),
            height: Math.abs(pointerFracY - state.anchor.y),
          })
        );
      };
      const onUp = () => {
        resizeState.current = null;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [rect]
  );

  const confirm = async () => {
    setBusy(true);
    try {
      const cropped = await cropImageDataUrl(preview, rect);
      onConfirm(cropped);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Crop logo"
      // Was z-50 with an opaque backdrop — but the on-canvas selected
      // element's wrapper (ProductConfigurator) sets zIndex:100 while
      // active, which sits ABOVE z-50 regardless of backdrop opacity. That
      // let the real canvas element's own resize/rotate handles paint on
      // top of this modal, reading as a second resizable logo. z-[200]
      // guarantees the modal — and its own single resize handle — always
      // wins the stacking order.
      className="fixed inset-0 z-[200] flex items-center justify-center p-6"
      style={{ background: "var(--pc-ink-950)" }}
    >
      <div className="bg-white rounded-2xl p-6 flex flex-col gap-4 max-w-lg w-full">
        <h2 className="font-serif text-2xl">Crop logo</h2>
        <div
          ref={frameRef}
          className="relative bg-cream rounded-lg overflow-hidden"
          style={{ aspectRatio: String(naturalAspect) }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt=""
            className="absolute inset-0 w-full h-full object-contain pointer-events-none"
            onLoad={(e) => {
              const img = e.currentTarget;
              if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                setNaturalAspect(img.naturalWidth / img.naturalHeight);
              }
            }}
          />
          <div
            onPointerDown={startMove}
            className="absolute border-2 border-terracotta cursor-move touch-none"
            style={{
              left: `${rect.x * 100}%`,
              top: `${rect.y * 100}%`,
              width: `${rect.width * 100}%`,
              height: `${rect.height * 100}%`,
              // A tinted fill *inside* the selection used to sit directly on
              // top of the logo's own colors — for a red logo against this
              // reddish terracotta tint, the boundary read as a second,
              // offset copy of the mark rather than a crop selection. A
              // spotlight shadow dims everything *outside* the rect instead,
              // leaving the kept area untouched (the standard cropper
              // convention), so there's no color interaction with the logo.
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
            }}
          >
            <div
              onPointerDown={startResize("tl")}
              aria-label="Resize crop area from top-left"
              role="button"
              tabIndex={0}
              className="absolute -left-2.5 -top-2.5 h-5 w-5 rounded-full bg-white border-2 border-terracotta cursor-nwse-resize touch-none"
            />
            <div
              onPointerDown={startResize("tr")}
              aria-label="Resize crop area from top-right"
              role="button"
              tabIndex={0}
              className="absolute -right-2.5 -top-2.5 h-5 w-5 rounded-full bg-white border-2 border-terracotta cursor-nesw-resize touch-none"
            />
            <div
              onPointerDown={startResize("bl")}
              aria-label="Resize crop area from bottom-left"
              role="button"
              tabIndex={0}
              className="absolute -left-2.5 -bottom-2.5 h-5 w-5 rounded-full bg-white border-2 border-terracotta cursor-nesw-resize touch-none"
            />
            <div
              onPointerDown={startResize("br")}
              aria-label="Resize crop area from bottom-right"
              role="button"
              tabIndex={0}
              className="absolute -right-2.5 -bottom-2.5 h-5 w-5 rounded-full bg-white border-2 border-terracotta cursor-nwse-resize touch-none"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg border border-line text-sm">
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={busy}
            className="px-4 py-2 rounded-lg bg-terracotta text-cream-light text-sm disabled:opacity-50"
          >
            {busy ? "Cropping…" : "Apply crop"}
          </button>
        </div>
      </div>
    </div>
  );
}
