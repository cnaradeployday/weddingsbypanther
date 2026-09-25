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
        <span className="text-xs uppercase tracking-wide text-muted">{label}</span>
        <div className="flex gap-2 flex-wrap">
          {allowedColors.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => commit(c)}
              aria-label={`Use color ${c}`}
              aria-pressed={value.toLowerCase() === c.toLowerCase()}
              className={`h-9 w-9 rounded-full border-2 ${value.toLowerCase() === c.toLowerCase() ? "border-terracotta" : "border-white"}`}
              style={{ backgroundColor: c, boxShadow: "0 0 0 1px #E6DFD3" }}
            />
          ))}
        </div>
        <p className="text-xs text-muted">Colors available for this print technique.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs uppercase tracking-wide text-muted">{label}</span>
      <div className="flex items-center gap-2">
        <label className="h-11 w-11 shrink-0 rounded-lg border border-line p-1 flex" aria-label={`${label} swatch`}>
          <input
            type="color"
            value={value}
            onChange={(e) => commit(e.target.value)}
            className="w-full h-full border-none p-0 bg-transparent cursor-pointer"
          />
        </label>
        <div className="flex-1 h-11 rounded-lg border border-line flex items-center px-3 gap-1.5">
          <span className="text-xs text-muted">HEX</span>
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
            className="w-full bg-transparent text-sm"
          />
        </div>
        {eyedropperAvailable && (
          <button
            type="button"
            aria-label="Pick color with eyedropper"
            onClick={async () => {
              const picked = await pickColorWithEyedropper();
              if (picked) commit(picked);
            }}
            className="h-11 w-11 shrink-0 rounded-lg border border-line flex items-center justify-center text-dark"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 4l6 6" />
              <path d="M17 7l-9.5 9.5L5 19l2.5-2.5" />
              <path d="M12 6l6 6" />
            </svg>
          </button>
        )}
      </div>
      {recent.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted w-14">Recent</span>
          {recent.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => commit(c)}
              aria-label={`Use recent color ${c}`}
              className="h-7 w-7 rounded-full border-2 border-white"
              style={{ backgroundColor: c, boxShadow: value.toLowerCase() === c ? "0 0 0 2px #5B2EE0" : "0 0 0 1px #E6DFD3" }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
