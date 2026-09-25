"use client";

import { useState } from "react";

const SHORTCUTS: [string, string][] = [
  ["Arrow keys", "Move the selected element"],
  ["Shift + Arrow keys", "Move in larger steps"],
  ["Delete / Backspace", "Remove the selected element"],
  ["Esc", "Deselect"],
  ["Ctrl/Cmd + Z", "Undo"],
  ["Ctrl/Cmd + Shift + Z (or Ctrl + Y)", "Redo"],
];

export function KeyboardShortcutsHelp() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Keyboard shortcuts"
        aria-expanded={open}
        className="h-11 w-11 flex items-center justify-center rounded-lg text-muted hover:bg-cream"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1.5 1-1.5 1.9" />
          <path d="M12 17h.01" />
        </svg>
      </button>
      {open && (
        <div role="dialog" aria-label="Keyboard shortcuts" className="absolute right-0 top-11 z-20 w-72 rounded-xl border border-line bg-white shadow-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-serif text-lg">Keyboard shortcuts</h3>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="h-11 w-11 -mr-2 flex items-center justify-center text-lg text-muted shrink-0"
            >
              ×
            </button>
          </div>
          <dl className="flex flex-col gap-1.5 text-xs">
            {SHORTCUTS.map(([key, desc]) => (
              <div key={key} className="flex justify-between gap-3">
                <dt className="font-medium text-dark shrink-0">{key}</dt>
                <dd className="text-muted text-right">{desc}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
