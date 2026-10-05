"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TEXT_FONTS, textFontStyle, type TextFontId } from "@/lib/textFonts";

// Compact, Canva-style font picker (replaces the old always-visible
// category-chips + 2-column grid, which ate a large chunk of the tool
// panel's height and crowded out the rest of the text controls). Closed,
// it's a single row showing the active font's name in its own face; opening
// it surfaces every font behind a search box instead of a permanently
// expanded list.
export function FontPicker({ value, onChange }: { value: string; onChange: (id: TextFontId) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const active = TEXT_FONTS.find((f) => f.id === value) ?? TEXT_FONTS[0];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TEXT_FONTS;
    return TEXT_FONTS.filter((f) => f.label.toLowerCase().includes(q));
  }, [query]);

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] tracking-[0.14em] uppercase" style={{ color: "var(--pc-ink-500)" }}>
        Font
      </span>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="w-full h-12 rounded-xl border-[1.5px] px-3.5 flex items-center justify-between text-left"
        style={{ borderColor: "var(--pc-ink-200)", background: "var(--pc-ink-50)" }}
      >
        <span className="truncate text-[17px] leading-tight" style={{ ...textFontStyle(active.id), color: "var(--pc-ink-950)" }}>
          {active.label}
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 ml-2" style={{ color: "var(--pc-ink-500)" }} aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div role="dialog" aria-modal="true" aria-label="Choose font" className="fixed inset-0 z-[200] flex items-end md:items-center justify-center bg-black/40 p-4" onClick={close}>
          <div
            className="w-full max-w-sm max-h-[75vh] rounded-2xl bg-white shadow-xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-line flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="font-serif text-lg">Choose a font</h3>
                <button type="button" onClick={close} aria-label="Close" className="text-xl leading-none px-1" style={{ color: "var(--pc-ink-500)" }}>
                  ×
                </button>
              </div>
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search fonts…"
                aria-label="Search fonts"
                className="w-full h-10 rounded-lg px-3 text-sm outline-none"
                style={{ border: "1px solid var(--pc-ink-200)", background: "var(--pc-ink-50)", color: "var(--pc-ink-950)" }}
              />
            </div>
            <div role="listbox" aria-label="Fonts" className="flex-1 overflow-y-auto p-2">
              {filtered.length === 0 && (
                <p className="text-sm text-center py-6" style={{ color: "var(--pc-ink-400)" }}>
                  No fonts match &ldquo;{query}&rdquo;.
                </p>
              )}
              {filtered.map((f) => {
                const isActive = f.id === value;
                return (
                  <button
                    key={f.id}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onClick={() => {
                      onChange(f.id);
                      close();
                    }}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left"
                    style={{ background: isActive ? "var(--pc-ink-50)" : "transparent" }}
                  >
                    <span className="flex flex-col min-w-0">
                      <span className="text-[11px] truncate" style={{ color: "var(--pc-ink-500)" }}>
                        {f.label}
                      </span>
                      <span className="text-xl truncate" style={{ ...textFontStyle(f.id), color: "var(--pc-ink-950)" }}>
                        AaBbCc
                      </span>
                    </span>
                    {isActive && (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-terracotta)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
