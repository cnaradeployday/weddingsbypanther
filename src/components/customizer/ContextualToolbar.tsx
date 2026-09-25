"use client";

import type { ElemKey } from "./types";

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
export function ContextualToolbar({
  elemType,
  rotationDeg,
  color,
  onChangeRotation,
  onChangeColor,
  onAlignCenter,
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
  onAlignCenter: () => void;
  onDelete?: () => void;
  deletable: boolean;
  colorEditable: boolean;
  // Type-specific extra controls (font name button + size for text, etc.)
  trailing?: React.ReactNode;
}) {
  return (
    <div
      role="toolbar"
      aria-label={`${elemType} options`}
      className="flex items-center gap-1 h-11 px-1.5 bg-white border border-line rounded-xl shadow-lg whitespace-nowrap"
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
        onClick={onAlignCenter}
        aria-label="Center in print area"
        className="h-9 w-9 flex items-center justify-center rounded-lg text-dark hover:bg-cream"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <path d="M12 3v18" />
          <rect x="6" y="7" width="12" height="4" rx="1" />
          <rect x="8" y="14" width="8" height="4" rx="1" />
        </svg>
      </button>
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
