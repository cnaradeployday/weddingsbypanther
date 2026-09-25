// Shared types for the redesigned editor (02-editor-tools.md). The frame
// and QR code are promoted to full elements alongside logo/monogram/names/
// date (EDIT-10, EDIT-13) — each with its own position/scale/rotation like
// the other four already had.

export type ElemKey = "logo" | "monogram" | "frame" | "names" | "date" | "qr";

export const ELEM_KEYS: ElemKey[] = ["logo", "monogram", "frame", "names", "date", "qr"];

export type ElemPos = { x: number; y: number };

export type TextAlign = "left" | "center" | "right";

// Per-text-element style (EDIT-07/EDIT-08) — names and date each get their
// own independent copy, same as they already have independent position/
// scale/rotation.
export type TextStyle = {
  color: string;
  // 0-100 slider values (not raw CSS units) — converted to em/line-height
  // at render time, same pattern as the rest of the editor's 0-100 sliders.
  letterSpacing: number;
  lineSpacing: number;
  // -100 (arc down) .. 0 (straight) .. 100 (arc up)
  curve: number;
  align: TextAlign;
};

export const DEFAULT_TEXT_STYLE: TextStyle = {
  color: "#1a1a1a",
  letterSpacing: 0,
  lineSpacing: 0,
  curve: 0,
  align: "center",
};

export type LogoRemoveWhiteMode = "never" | "background" | "all";

// The full per-zone design state (extends what 01-bug-fixes.md's ZoneDesign
// covered). Kept as one object so it can be the payload of the undo/redo
// history (designHistory.ts) and so every tool panel reads/writes one
// source of truth instead of ~20 independent useState calls.
export type Design = {
  names: string;
  namesStyle: TextStyle;
  textFont: string;

  date: string; // ISO yyyy-mm-dd
  dateStyle: TextStyle;

  monogram: string; // MonogramId | ""
  monogramColor: string;

  frame: string; // FrameId | ""
  frameColor: string;

  logoFile: File | null;
  logoPreview: string | null;
  logoOriginalPreview: string | null; // pre-"remove background" copy, for Restore original
  logoRemoveWhiteMode: LogoRemoveWhiteMode;

  inkColor: string;
  colorTextInput: string;

  qrUrl: string;
  qrColor: string;

  positions: Record<ElemKey, ElemPos>;
  elemScale: Record<ElemKey, number>;
  elemRotationOffset: Record<ElemKey, number>;
  elemOrder: ElemKey[];
  locked: Partial<Record<ElemKey, boolean>>;
  hidden: Partial<Record<ElemKey, boolean>>;
};

export const DEFAULT_SCALES: Record<ElemKey, number> = {
  logo: 1,
  monogram: 1,
  frame: 1,
  names: 1,
  date: 1,
  qr: 1,
};

export const DEFAULT_ROTATIONS: Record<ElemKey, number> = {
  logo: 0,
  monogram: 0,
  frame: 0,
  names: 0,
  date: 0,
  qr: 0,
};

export const ELEM_LABELS: Record<ElemKey, string> = {
  logo: "Logo",
  monogram: "Monogram",
  frame: "Frame",
  names: "Text",
  date: "Date",
  qr: "QR code",
};

// Which elements are "content-gated" — only shown/selectable once the
// shopper has actually put something there. Names is always present
// (required, BUG-02); frame/monogram/logo/qr only exist once chosen.
export function isElemPresent(design: Design, key: ElemKey): boolean {
  switch (key) {
    case "names":
      return true;
    case "date":
      return !!design.date;
    case "monogram":
      return !!design.monogram;
    case "frame":
      return !!design.frame;
    case "logo":
      return !!design.logoPreview;
    case "qr":
      return !!design.qrUrl;
  }
}
