"use client";

import type { TextAlign, TextStyle } from "./types";
import { ColorPicker } from "./ColorPicker";
import { SegmentedControl } from "./SegmentedControl";
import { FontPicker } from "./FontPicker";
import type { TextFontId } from "@/lib/textFonts";

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
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-serif text-[22px]" style={{ color: "var(--pc-ink-950)" }}>
          {title}
        </h2>
      </div>

      {textEditable && onChangeText && (
        <textarea
          id="text-tool-content"
          aria-label="Text"
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
          className="w-full min-h-[72px] rounded-xl border-[1.5px] px-3.5 py-3 text-[15px] resize-none outline-none transition-colors"
          style={{ borderColor: "var(--pc-ink-200)", background: "var(--pc-ink-50)", color: "var(--pc-ink-950)" }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "var(--color-terracotta)";
            e.currentTarget.style.background = "#fff";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "var(--pc-ink-200)";
            e.currentTarget.style.background = "var(--pc-ink-50)";
          }}
        />
      )}

      <FontPicker value={font} onChange={(id: TextFontId) => onChangeFont(id)} />

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <span className="text-[11px] tracking-[0.14em] uppercase" style={{ color: "var(--pc-ink-500)" }}>
            Size
          </span>
          <div className="flex items-center p-0.5 gap-0.5 rounded-[9px] h-9" style={{ background: "rgba(118,118,128,0.12)" }}>
            <button type="button" aria-label="Decrease size" onClick={() => onStepSize(-1)} className="w-8 h-8 rounded-[7px] grid place-items-center" style={{ color: "var(--pc-ink-700)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                <path d="M5 12h14" />
              </svg>
            </button>
            <span className="flex-1 text-center text-[13px] tabular-nums" style={{ color: "var(--pc-ink-950)" }}>
              {sizeCm != null ? `${sizeCm.toFixed(1)} cm` : "—"}
            </span>
            <button type="button" aria-label="Increase size" onClick={() => onStepSize(1)} className="w-8 h-8 rounded-[7px] grid place-items-center" style={{ color: "var(--pc-ink-700)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                <path d="M5 12h14M12 5v14" />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-[11px] tracking-[0.14em] uppercase" style={{ color: "var(--pc-ink-500)" }}>
            Align
          </span>
          <SegmentedControl
            height={32}
            value={style.align}
            onChange={(a) => onChangeStyle({ ...style, align: a })}
            options={(["left", "center", "right"] as TextAlign[]).map((a) => ({
              id: a,
              ariaLabel: a[0].toUpperCase() + a.slice(1),
              label: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  {a === "left" && <path d="M4 6h16M4 12h10M4 18h14" />}
                  {a === "center" && <path d="M4 6h16M7 12h10M5 18h14" />}
                  {a === "right" && <path d="M4 6h16M10 12h10M6 18h14" />}
                </svg>
              ),
            }))}
          />
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
        {/* Date is always a single fixed-format line (whitespace-nowrap on
            canvas) — line spacing would have no visible effect there. */}
        {textEditable && (
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
        )}
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
