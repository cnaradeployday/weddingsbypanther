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
    <div className="flex flex-col gap-6">
      <h2 className="font-serif text-2xl">Print technique</h2>
      {techniques.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {techniques.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onChangeTechnique(t.id)}
              aria-pressed={techniqueId === t.id}
              className={`rounded-lg border px-3 py-3 text-sm text-left ${techniqueId === t.id ? "border-dark bg-cream" : "border-line"}`}
            >
              <span className="block font-medium">{t.technique}</span>
              <span className="text-xs text-muted">{t.extra_price > 0 ? `+${formatUSD(t.extra_price)}` : "Included"}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted">No print techniques configured for this product.</p>
      )}
      {inkColorSlot}
    </div>
  );
}
