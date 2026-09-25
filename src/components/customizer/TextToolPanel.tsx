"use client";

import { useState } from "react";
import { TEXT_FONTS, textFontStyle } from "@/lib/textFonts";
import type { TextAlign, TextStyle } from "./types";
import { ColorPicker } from "./ColorPicker";

// The 6 existing fonts' categories, for the filter chips (EDIT-07) — kept
// here rather than in textFonts.ts since it's purely a UI grouping, not
// part of the font data itself; the 6 fonts and their ids are unchanged
// from the original customizer.
const FONT_CATEGORIES: Record<string, "script" | "serif" | "sans"> = {
  greatvibes: "script",
  parisienne: "script",
  cormorant: "serif",
  playfair: "serif",
  ebgaramond: "serif",
  montserrat: "sans",
};

const CATEGORY_LABELS: { id: "all" | "script" | "serif" | "sans"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "script", label: "Script" },
  { id: "serif", label: "Serif" },
  { id: "sans", label: "Sans serif" },
];

export function TextToolPanel({
  title,
  text,
  onChangeText,
  textEditable,
  font,
  onChangeFont,
  sizeCm,
  onStepSize,
  style,
  onChangeStyle,
  allowedColors,
  maxChars,
  maxLines,
}: {
  title: string;
  text: string;
  onChangeText?: (value: string) => void;
  textEditable: boolean;
  font: string;
  onChangeFont: (id: string) => void;
  // Read-only display (matches the pre-existing pattern this replaces: a
  // computed "8.6 cm" label next to +/- steppers, not a typed value) — the
  // real size is elemScale, which the steppers adjust in fixed increments;
  // this is only what it currently renders to, in cm.
  sizeCm: number | null;
  onStepSize: (dir: 1 | -1) => void;
  style: TextStyle;
  onChangeStyle: (style: TextStyle) => void;
  allowedColors?: string[];
  maxChars?: number;
  maxLines?: number;
}) {
  const [category, setCategory] = useState<"all" | "script" | "serif" | "sans">("all");
  const previewText = text || "Amelia & Ravi";
  const visibleFonts = TEXT_FONTS.filter((f) => category === "all" || FONT_CATEGORIES[f.id] === category);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-serif text-2xl">{title}</h2>
      </div>

      {textEditable && onChangeText && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="text-tool-content" className="text-xs uppercase tracking-wide text-muted">
            Text
          </label>
          <textarea
            id="text-tool-content"
            value={text}
            rows={maxLines ?? 2}
            onChange={(e) => {
              const capped = e.target.value
                .split("\n")
                .slice(0, maxLines ?? 2)
                .map((line) => (maxChars ? line.slice(0, maxChars) : line))
                .join("\n");
              onChangeText(capped);
            }}
            className="w-full rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark resize-none"
          />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-wide text-muted">Font</span>
        <div className="flex gap-1.5 flex-wrap">
          {CATEGORY_LABELS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              aria-pressed={category === c.id}
              className={`px-2.5 py-1.5 rounded-full text-xs border ${
                category === c.id ? "border-dark bg-dark text-cream-light" : "border-line text-muted"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {visibleFonts.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => onChangeFont(f.id)}
              aria-pressed={font === f.id}
              className={`rounded-lg border px-3 py-2 text-left overflow-hidden ${
                font === f.id ? "border-dark bg-cream" : "border-line"
              }`}
            >
              <span className="block text-[9px] uppercase tracking-wide text-muted">{f.label}</span>
              <span className="block truncate text-lg leading-tight" style={textFontStyle(f.id)}>
                {previewText}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <div className="flex-1 flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-wide text-muted">Size</span>
          <div className="flex items-center border border-line rounded-lg h-11">
            <button type="button" aria-label="Decrease size" onClick={() => onStepSize(-1)} className="w-11 h-full text-lg text-dark">
              −
            </button>
            <span className="flex-1 text-center text-sm">{sizeCm != null ? `${sizeCm.toFixed(1)} cm` : "—"}</span>
            <button type="button" aria-label="Increase size" onClick={() => onStepSize(1)} className="w-11 h-full text-lg text-dark">
              +
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-wide text-muted">Align</span>
          <div className="flex border border-line rounded-lg h-11 overflow-hidden">
            {(["left", "center", "right"] as TextAlign[]).map((a) => (
              <button
                key={a}
                type="button"
                aria-label={a[0].toUpperCase() + a.slice(1)}
                aria-pressed={style.align === a}
                onClick={() => onChangeStyle({ ...style, align: a })}
                className={`w-10 flex items-center justify-center ${
                  style.align === a ? "bg-[#EEE9FF] text-[#4520B8]" : "text-muted"
                }`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  {a === "left" && <path d="M4 6h16M4 12h10M4 18h14" />}
                  {a === "center" && <path d="M4 6h16M7 12h10M5 18h14" />}
                  {a === "right" && <path d="M4 6h16M10 12h10M6 18h14" />}
                </svg>
              </button>
            ))}
          </div>
        </div>
      </div>

      <ColorPicker
        value={style.color}
        onChange={(hex) => onChangeStyle({ ...style, color: hex })}
        allowedColors={allowedColors}
      />

      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-wide text-muted">Letter spacing</span>
          <input
            type="range"
            min={0}
            max={100}
            value={style.letterSpacing}
            onChange={(e) => onChangeStyle({ ...style, letterSpacing: Number(e.target.value) })}
            className="w-full accent-terracotta"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-wide text-muted">Line spacing</span>
          <input
            type="range"
            min={0}
            max={100}
            value={style.lineSpacing}
            onChange={(e) => onChangeStyle({ ...style, lineSpacing: Number(e.target.value) })}
            className="w-full accent-terracotta"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-wide text-muted">Curve</span>
          <input
            type="range"
            min={-100}
            max={100}
            value={style.curve}
            onChange={(e) => onChangeStyle({ ...style, curve: Number(e.target.value) })}
            className="w-full accent-terracotta"
          />
        </label>
      </div>
    </div>
  );
}
