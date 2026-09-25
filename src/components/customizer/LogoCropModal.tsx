"use client";

import { useCallback, useRef, useState } from "react";
import { clampCropRect, cropImageDataUrl, type CropRect } from "@/lib/cropImage";

// EDIT-11's "Crop": a crop frame with drag handles over the logo. Kept
// intentionally simple — move the frame by dragging inside it, resize from
// the corner handle — rather than a full-featured cropper library, since
// the only requirement is "crop frame with handles."
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
  const frameRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ mode: "move" | "resize"; startX: number; startY: number; startRect: CropRect } | null>(
    null
  );

  const startDrag = useCallback(
    (mode: "move" | "resize") => (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragState.current = { mode, startX: e.clientX, startY: e.clientY, startRect: rect };
      const onMove = (ev: PointerEvent) => {
        const state = dragState.current;
        const frame = frameRef.current;
        if (!state || !frame) return;
        const box = frame.getBoundingClientRect();
        const dxFrac = (ev.clientX - state.startX) / box.width;
        const dyFrac = (ev.clientY - state.startY) / box.height;
        if (state.mode === "move") {
          setRect(clampCropRect({ ...state.startRect, x: state.startRect.x + dxFrac, y: state.startRect.y + dyFrac }));
        } else {
          setRect(
            clampCropRect({
              ...state.startRect,
              width: state.startRect.width + dxFrac,
              height: state.startRect.height + dyFrac,
            })
          );
        }
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
    <div role="dialog" aria-modal="true" aria-label="Crop logo" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6">
      <div className="bg-white rounded-2xl p-6 flex flex-col gap-4 max-w-lg w-full">
        <h2 className="font-serif text-2xl">Crop logo</h2>
        <div ref={frameRef} className="relative bg-cream rounded-lg overflow-hidden" style={{ aspectRatio: "1" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="" className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
          <div
            onPointerDown={startDrag("move")}
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
              onPointerDown={startDrag("resize")}
              aria-label="Resize crop area"
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
