"use client";

import { useState } from "react";
import type { ElemKey } from "./types";
import type { HorizontalAlign, VerticalAlign } from "@/lib/alignment";

// EDIT-04's floating toolbar above the selected element — a compact set of
// the most common per-type actions (the full set of controls lives in the
// tool panel, opened from the rail). Positioned by the caller (it needs the
// element's live on-screen rect, which only the canvas knows).
//
// Note on scope: the prototype's floating toolbar includes a "Duplicate"
// button. This editor keeps the existing one-instance-per-tool model (one
// logo, one text block, one QR code, etc.) rather than introducing
// arbitrary multiple elements of the same type — a bigger data-model and
// server-pipeline change than this document asks for — so no Duplicate
// button is shown.
const H_ALIGNS: { id: HorizontalAlign; label: string }[] = [
  { id: "left", label: "Left" },
  { id: "center", label: "Center" },
  { id: "right", label: "Right" },
];
const V_ALIGNS: { id: VerticalAlign; label: string }[] = [
  { id: "top", label: "Top" },
  { id: "middle", label: "Middle" },
  { id: "bottom", label: "Bottom" },
];

export function ContextualToolbar({
  elemType,
  rotationDeg,
  color,
  onChangeRotation,
  onChangeColor,
  onAlign,
  onDelete,
  deletable,
  colorEditable,
  trailing,
}: {
  elemType: ElemKey;
  rotationDeg: number;
  color?: string;
  onChangeRotation: (deg: number) => void;
  onChangeColor?: (hex: string) => void;
  // EDIT-15: align the selected element to the print area along one axis
  // at a time (left/center/right, top/middle/bottom) — the other axis's
  // position is left untouched.
  onAlign: (axis: "horizontal" | "vertical", align: HorizontalAlign | VerticalAlign) => void;
  onDelete?: () => void;
  deletable: boolean;
  colorEditable: boolean;
  // Type-specific extra controls (font name button + size for text, etc.)
  trailing?: React.ReactNode;
}) {
  const [showAlignMenu, setShowAlignMenu] = useState(false);
  return (
    <div
      role="toolbar"
      aria-label={`${elemType} options`}
      className="relative flex items-center gap-1 h-11 px-1.5 bg-white border border-line rounded-xl shadow-lg whitespace-nowrap"
    >
      {trailing}
      {colorEditable && onChangeColor && (
        <>
          <span className="w-px h-5 bg-line" aria-hidden="true" />
          <label className="h-9 w-9 flex items-center justify-center rounded-lg cursor-pointer" aria-label="Color">
            <input
              type="color"
              value={color ?? "#1a1a1a"}
              onChange={(e) => onChangeColor(e.target.value)}
              className="h-5 w-5 rounded-full border-none p-0 bg-transparent cursor-pointer"
            />
          </label>
        </>
      )}
      <span className="w-px h-5 bg-line" aria-hidden="true" />
      <label className="flex items-center gap-1 px-1 text-xs text-dark">
        <span className="sr-only">Rotation in degrees</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <path d="M21 12a9 9 0 1 1-3-6.7" />
          <path d="M21 3v6h-6" />
        </svg>
        <input
          type="number"
          value={Math.round(rotationDeg)}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v)) onChangeRotation(Math.max(-180, Math.min(180, v)));
          }}
          className="w-11 bg-transparent text-center"
          aria-label="Rotation in degrees"
        />
        °
      </label>
      <button
        type="button"
        onClick={() => setShowAlignMenu((s) => !s)}
        aria-label="Align to print area"
        aria-expanded={showAlignMenu}
        className={`h-9 w-9 flex items-center justify-center rounded-lg text-dark hover:bg-cream ${showAlignMenu ? "bg-cream" : ""}`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <path d="M12 3v18" />
          <rect x="6" y="7" width="12" height="4" rx="1" />
          <rect x="8" y="14" width="8" height="4" rx="1" />
        </svg>
      </button>
      {showAlignMenu && (
        <div className="absolute top-full right-0 mt-1.5 z-10 bg-white border border-line rounded-xl shadow-lg p-2.5 flex flex-col gap-2 w-40">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wide text-muted">Horizontal</span>
            <div className="flex border border-line rounded-lg overflow-hidden">
              {H_ALIGNS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => {
                    onAlign("horizontal", a.id);
                    setShowAlignMenu(false);
                  }}
                  className="flex-1 h-8 text-xs text-dark hover:bg-cream"
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wide text-muted">Vertical</span>
            <div className="flex border border-line rounded-lg overflow-hidden">
              {V_ALIGNS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => {
                    onAlign("vertical", a.id);
                    setShowAlignMenu(false);
                  }}
                  className="flex-1 h-8 text-xs text-dark hover:bg-cream"
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {deletable && onDelete && (
        <>
          <span className="w-px h-5 bg-line" aria-hidden="true" />
          <button
            type="button"
            onClick={onDelete}
            aria-label="Delete"
            className="h-9 w-9 flex items-center justify-center rounded-lg text-dark hover:bg-cream"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}
