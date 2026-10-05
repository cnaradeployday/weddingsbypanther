"use client";

import { useEffect, useState } from "react";
import { isEyeDropperSupported, pickColorWithEyedropper } from "@/lib/eyedropper";
import { loadRecentColors, saveRecentColors, addRecentColor } from "@/lib/recentColors";

// EDIT-07's color panel: swatch + picker, HEX field, eyedropper (hidden
// where the browser doesn't support the EyeDropper API), and recent
// colors — shared by every element type that gets a color control
// (text, date, monogram, frame, QR; logo's ink color already had its own
// very similar UI pre-existing, left as-is).
export function ColorPicker({
  value,
  onChange,
  label = "Color",
  allowedColors,
}: {
  value: string;
  onChange: (hex: string) => void;
  label?: string;
  // When a technique restricts colors (single-color-ink), only these are
  // offered — EDIT-07: "don't invent color rules; if the configuration
  // doesn't say, report it" (see DISCOVERY.md gap #3 for the one shape of
  // restriction that actually exists in the schema).
  allowedColors?: string[];
  eyedropper?: boolean;
}) {
  const [hexInput, setHexInput] = useState(value);
  const [recent, setRecent] = useState<string[]>([]);
  const eyedropperAvailable = isEyeDropperSupported();

  useEffect(() => {
    // localStorage isn't available during server render — read once the
    // component has actually mounted in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecent(loadRecentColors());
  }, []);

  useEffect(() => {
    // Keeps the editable hex text in sync when the color changes from
    // outside this input (the swatch, a recent/allowed-color button, or an
    // undo/redo).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHexInput(value);
  }, [value]);

  const commit = (hex: string) => {
    onChange(hex);
    const next = addRecentColor(recent, hex);
    setRecent(next);
    saveRecentColors(next);
  };

  const applyHexInput = () => {
    const trimmed = hexInput.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) commit(trimmed);
    else setHexInput(value);
  };

  if (allowedColors && allowedColors.length > 0) {
    return (
      <div className="flex flex-col gap-2">
        <span className="text-[11px] tracking-[0.14em] uppercase" style={{ color: "var(--pc-ink-500)" }}>
          {label}
        </span>
        <div className="flex gap-2.5 flex-wrap">
          {allowedColors.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => commit(c)}
              aria-label={`Use color ${c}`}
              aria-pressed={value.toLowerCase() === c.toLowerCase()}
              className="h-8 w-8 rounded-full"
              style={{
                backgroundColor: c,
                border: "1px solid rgba(18,22,32,0.15)",
                boxShadow: value.toLowerCase() === c.toLowerCase() ? "0 0 0 2px #fff, 0 0 0 4px var(--color-terracotta)" : "none",
              }}
            />
          ))}
        </div>
        <p className="text-xs" style={{ color: "var(--pc-ink-400)" }}>
          Colors available for this print technique.
        </p>
      </div>
    );
  }

  // The picker swatch (always filled with the live `value`) and a recent
  // color that happens to equal `value` used to be visually identical
  // circles in one unlabeled row — "no sé cuál abre el selector y cuál ya
  // es un color aplicado." Split into two explicitly labeled groups: one
  // "Elegir color" control (the picker + hex field + eyedropper) and, only
  // when there's history, a separate "Colores recientes" row — and mark the
  // picker swatch itself with a small pencil badge so it reads as a button,
  // not just another color sample.
  return (
    <div className="flex flex-col gap-3">
      <span className="text-[11px] tracking-[0.14em] uppercase" style={{ color: "var(--pc-ink-500)" }}>
        {label}
      </span>
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium" style={{ color: "var(--pc-ink-500)" }}>
          Elegir color
        </span>
        <div className="flex items-center gap-2.5">
          <label
            className="h-9 w-9 shrink-0 rounded-full cursor-pointer relative overflow-hidden"
            style={{ backgroundColor: value, border: "1px solid rgba(18,22,32,0.15)" }}
            aria-label={`${label}: open color picker`}
          >
            <input
              type="color"
              value={value}
              onChange={(e) => commit(e.target.value)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <span
              className="absolute -right-0.5 -bottom-0.5 h-4 w-4 rounded-full flex items-center justify-center pointer-events-none"
              style={{ background: "var(--color-terracotta)", border: "1.5px solid #fff" }}
              aria-hidden="true"
            >
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
            </span>
          </label>
          {eyedropperAvailable && (
            <button
              type="button"
              aria-label="Pick color with eyedropper"
              onClick={async () => {
                const picked = await pickColorWithEyedropper();
                if (picked) commit(picked);
              }}
              className="h-8 w-8 shrink-0 rounded-full flex items-center justify-center"
              style={{ color: "var(--pc-ink-600)" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 4l6 6" />
                <path d="M17 7l-9.5 9.5L5 19l2.5-2.5" />
                <path d="M12 6l6 6" />
              </svg>
            </button>
          )}
          <span className="ml-auto font-mono text-xs" style={{ color: "var(--pc-ink-500)" }}>
            {value.toUpperCase()}
          </span>
        </div>
        <input
          type="text"
          value={hexInput}
          onChange={(e) => setHexInput(e.target.value)}
          onBlur={applyHexInput}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              applyHexInput();
            }
          }}
          aria-label="Hex color code"
          placeholder="#1A1A1A"
          className="w-full h-9 rounded-lg px-3 text-sm bg-transparent outline-none"
          style={{ border: "1px solid var(--pc-ink-200)", color: "var(--pc-ink-950)" }}
        />
      </div>
      {recent.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium" style={{ color: "var(--pc-ink-500)" }}>
            Colores recientes
          </span>
          <div className="flex items-center gap-2.5 flex-wrap">
            {recent.map((c) => {
              const applied = value.toLowerCase() === c.toLowerCase();
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => commit(c)}
                  aria-label={`Use recent color ${c}`}
                  aria-pressed={applied}
                  title="Click to apply"
                  className="h-8 w-8 rounded-full shrink-0"
                  style={{
                    backgroundColor: c,
                    border: "1px solid rgba(18,22,32,0.15)",
                    boxShadow: applied ? "0 0 0 2px #fff, 0 0 0 4px var(--color-terracotta)" : "none",
                  }}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
