"use client";

// iOS-style segmented control shared by the redesigned Design step: the
// header's step indicator, the Logo panel's placement picker, and the
// Text panel's size/align rows all use the same track + pill pattern.
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  height = 32,
  fitContent = false,
  className = "",
}: {
  options: { id: T; label: React.ReactNode; ariaLabel?: string }[];
  value: T;
  onChange: (id: T) => void;
  height?: number;
  // Steps ("Design"/"Options"/"Review") size to their own label width;
  // everything else (placement, align, size) splits the track evenly.
  fitContent?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`inline-flex p-0.5 gap-0.5 rounded-[9px] ${className}`}
      style={{ background: "rgba(118,118,128,0.12)" }}
      role="group"
    >
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            aria-pressed={active}
            aria-label={o.ariaLabel}
            className={`rounded-[7px] text-[13px] transition-colors duration-150 flex items-center justify-center ${
              fitContent ? "px-[18px]" : "flex-1"
            }`}
            style={{
              height,
              background: active ? "#fff" : "transparent",
              color: active ? "var(--pc-ink-950)" : "var(--pc-ink-500)",
              boxShadow: active ? "0 1px 3px rgba(18,22,32,0.12)" : "none",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
