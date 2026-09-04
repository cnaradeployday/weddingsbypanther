// A plain brand-color panel for marketing sections that would otherwise
// need a real product photo we don't have on hand yet (see businessType.tsx
// — heroImage/storefrontPitchImage are null for verticals without stock
// photography). A soft dot-grid over a diagonal gradient reads as an
// intentional abstract graphic rather than a missing image, and swaps
// cleanly for a real photo later without touching any layout code.
export function BrandPanel({ className = "" }: { className?: string }) {
  return (
    <div
      className={`relative h-full w-full overflow-hidden ${className}`}
      style={{ background: "linear-gradient(135deg, var(--color-terracotta) 0%, var(--color-terracotta-dark) 100%)" }}
    >
      <svg className="absolute inset-0 h-full w-full opacity-20" aria-hidden="true">
        <defs>
          <pattern id="brand-panel-dots" width="28" height="28" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="2" fill="white" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#brand-panel-dots)" />
      </svg>
    </div>
  );
}
