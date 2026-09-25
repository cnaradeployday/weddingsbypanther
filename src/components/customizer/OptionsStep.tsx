"use client";

import { formatUSD, applyMarkup } from "@/lib/format";

// FLOW-03 — Step 2 · Options: variant, quantity, sample, sticky summary.
// Print technique moved to the Design step's tool rail (it affects how the
// whole design renders, so it needs picking before/while designing).
// The design preview itself is rendered by the caller (same canvas as the
// Design step, per FLOW-03: "the product with the design on the left,
// always visible") — this component is only the right-hand options panel.
export function OptionsStep({
  productName,
  productDescription,
  unitPrice,
  minOrder,
  productionTime,
  variants,
  variantId,
  onChangeVariant,
  markupPct,
  quantity,
  quantityInput,
  onChangeQuantityInput,
  onCommitQuantityInput,
  quantityBelowMinimum,
  quantityErrorId,
  quickQuantities,
  popularQty,
  onSelectQuantity,
  allowSample,
  total,
  onNext,
}: {
  productName: string;
  productDescription: string;
  unitPrice: number;
  minOrder: number;
  productionTime: string | null;
  variants: { id: string; label: string; price_delta: number; sku?: string | null }[];
  variantId: string;
  onChangeVariant: (id: string) => void;
  markupPct: number;
  quantity: number;
  quantityInput: string;
  onChangeQuantityInput: (v: string) => void;
  onCommitQuantityInput: () => void;
  quantityBelowMinimum: boolean;
  quantityErrorId: string;
  quickQuantities: number[];
  popularQty: number | null;
  onSelectQuantity: (q: number) => void;
  allowSample: boolean;
  total: number;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-3xl mb-2">{productName}</h1>
        <p className="text-xl mb-1">
          {formatUSD(unitPrice)} <span className="text-sm text-muted font-normal">per piece · min {minOrder}</span>
        </p>
        {productionTime && <p className="text-sm text-muted mb-3">Production time: {productionTime}</p>}
        <p className="text-muted">{productDescription}</p>
      </div>

      {variants.length > 0 && (
        <div>
          <label className="text-xs uppercase tracking-wide text-muted block mb-2">
            {variants[0]?.sku ? "Option" : "Variant"}
          </label>
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => onChangeVariant(v.id)}
                className={`px-4 py-2 rounded-lg text-sm border text-left ${variantId === v.id ? "border-dark bg-cream" : "border-line"}`}
              >
                <span className="block font-medium">{v.label}</span>
                {v.price_delta !== 0 && (
                  <span className="text-xs text-muted">
                    {v.price_delta > 0 ? "+" : ""}
                    {formatUSD(applyMarkup(v.price_delta, markupPct))}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <label htmlFor="options-quantity-input" className="text-xs uppercase tracking-wide text-muted">
            Quantity
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onSelectQuantity(Math.max(minOrder, quantity - minOrder))}
              aria-label="Decrease quantity"
              className="h-11 w-11 rounded-full border border-line flex items-center justify-center"
            >
              −
            </button>
            <input
              id="options-quantity-input"
              type="number"
              inputMode="numeric"
              value={quantityInput}
              onChange={(e) => onChangeQuantityInput(e.target.value)}
              onBlur={onCommitQuantityInput}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              aria-invalid={quantityBelowMinimum}
              aria-describedby={quantityBelowMinimum ? quantityErrorId : undefined}
              className={`w-16 text-center font-medium rounded-lg border py-1 focus:outline-none focus:border-dark ${quantityBelowMinimum ? "border-red-500" : "border-line"}`}
            />
            <button
              type="button"
              onClick={() => onSelectQuantity(quantity + minOrder)}
              aria-label="Increase quantity"
              className="h-11 w-11 rounded-full border border-line flex items-center justify-center"
            >
              +
            </button>
          </div>
        </div>
        {quantityBelowMinimum && (
          <p id={quantityErrorId} className="text-xs text-red-600 mb-2">
            The minimum order is {minOrder} units.
          </p>
        )}
        <p className="text-xs text-muted mb-2">Minimum order: {minOrder} units</p>
        <div className="flex gap-2 flex-wrap">
          {quickQuantities.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => onSelectQuantity(q)}
              className={`px-4 py-2 rounded-full text-sm border flex items-center gap-1.5 ${quantity === q ? "bg-dark text-cream-light border-dark" : "border-line"}`}
            >
              {q}
              <span className="text-[10px] uppercase tracking-wide opacity-80">{formatUSD(unitPrice * q)}</span>
              {q === popularQty && (
                <span className={`text-[10px] uppercase tracking-wide ${quantity === q ? "text-cream-light/70" : "text-terracotta"}`}>Popular</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {allowSample && (
        <p className="text-sm text-muted">Order 1 sample before production (+{formatUSD(50)}) is available in Review.</p>
      )}

      <div className="sticky bottom-0 -mx-6 md:mx-0 bg-white md:bg-cream md:rounded-xl border-t md:border border-line p-4 md:p-6 flex items-center justify-between gap-4 mt-2">
        <div>
          <p className="font-serif text-2xl">{formatUSD(total)}</p>
          <p className="text-xs text-muted">
            {quantity} × {formatUSD(unitPrice)} · Digital proof in 48h{productionTime ? ` · ${productionTime}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onNext}
          className="px-6 py-3 rounded-full bg-terracotta text-cream-light text-sm font-medium hover:bg-terracotta-dark transition-colors shrink-0"
        >
          Next: Review
        </button>
      </div>
    </div>
  );
}
