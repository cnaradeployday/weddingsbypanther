"use client";

import { ColorPicker } from "./ColorPicker";

// Shared shape for the Frame and Monogram tool panels (EDIT-09/EDIT-10):
// pick an icon ("None" plus the existing fixed set — 9 frames, 5 monogram
// icons, unchanged), then color it. Each is now an independent canvas
// element (its own position/scale/rotation, via the contextual toolbar),
// so this panel only covers what's specific to picking *which* icon.
export function IconElementPanel<T extends { id: string; label: string }>({
  title,
  options,
  selectedId,
  onSelect,
  renderIcon,
  color,
  onChangeColor,
  allowedColors,
}: {
  title: string;
  options: T[];
  selectedId: string;
  onSelect: (id: string) => void;
  renderIcon: (id: string, color: string) => React.ReactNode;
  color: string;
  onChangeColor: (hex: string) => void;
  allowedColors?: string[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-serif text-[22px]" style={{ color: "var(--pc-ink-950)" }}>
        {title}
      </h2>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onSelect("")}
          aria-pressed={selectedId === ""}
          className="h-14 w-16 rounded-2xl flex items-center justify-center text-[9px] font-medium shrink-0 transition-colors"
          style={{
            background: selectedId === "" ? "var(--pc-ink-950)" : "var(--pc-ink-50)",
            color: selectedId === "" ? "#fff" : "var(--pc-ink-500)",
          }}
        >
          None
        </button>
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            title={opt.label}
            onClick={() => onSelect(opt.id)}
            aria-pressed={selectedId === opt.id}
            aria-label={opt.label}
            className="h-14 w-16 rounded-2xl border-2 flex items-center justify-center shrink-0"
            style={{
              borderColor: selectedId === opt.id ? "var(--color-terracotta)" : "transparent",
              background: "var(--pc-ink-50)",
              color: "var(--pc-ink-950)",
            }}
          >
            {renderIcon(opt.id, "currentColor")}
          </button>
        ))}
      </div>
      {selectedId && (
        <ColorPicker value={color} onChange={onChangeColor} allowedColors={allowedColors} />
      )}
    </div>
  );
}
