"use client";

import { formatUSD } from "@/lib/format";

// Print technique + (when the technique is single-ink) ink color — moved
// here from the Options step per request: the technique affects how the
// whole design is rendered (single-color fill, engraving debossed look,
// etc.), so it needs to be picked before/while designing, not after.
export function TechniqueToolPanel({
  techniques,
  techniqueId,
  onChangeTechnique,
  inkColorSlot,
}: {
  techniques: { id: string; technique: string; extra_price: number }[];
  techniqueId: string;
  onChangeTechnique: (id: string) => void;
  inkColorSlot: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-serif text-[22px]" style={{ color: "var(--pc-ink-950)" }}>
          Technique
        </h2>
        <p className="text-sm" style={{ color: "var(--pc-ink-500)" }}>
          How your design is applied to the product.
        </p>
      </div>
      {techniques.length > 0 ? (
        <div className="rounded-2xl overflow-hidden flex flex-col" style={{ background: "var(--pc-ink-50)" }}>
          {techniques.map((t, i) => {
            const selected = techniqueId === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onChangeTechnique(t.id)}
                aria-pressed={selected}
                className="h-14 px-4 flex items-center justify-between text-left text-[15px] transition-colors"
                style={{ borderTop: i ? "1px solid var(--pc-ink-100)" : "none", color: "var(--pc-ink-950)" }}
              >
                <span className="flex flex-col">
                  <span>{t.technique}</span>
                  <span className="text-xs" style={{ color: "var(--pc-ink-500)" }}>
                    {t.extra_price > 0 ? `+${formatUSD(t.extra_price)}` : "Included"}
                  </span>
                </span>
                {selected && (
                  <span style={{ color: "var(--color-terracotta)" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-xs" style={{ color: "var(--pc-ink-400)" }}>
          No print techniques configured for this product.
        </p>
      )}
      {inkColorSlot}
    </div>
  );
}
