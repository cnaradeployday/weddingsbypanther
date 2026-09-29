"use client";

import { formatUSD, applyMarkup } from "@/lib/format";
import type { ValidationIssue } from "@/lib/purchaseFlowValidation";

// Confirmación — Options and Review merged into one step per request:
// quantity/variant selection and the pre-order checklist together, next to
// a read-only preview (ConfirmationPreview) instead of the live editable
// canvas. The design itself can no longer be edited from here — "No poder
// editar nada del logo en esa pantalla" — only reviewed and confirmed.
const LEVEL_STYLES: Record<ValidationIssue["level"], string> = {
  blocking: "border-red-300 bg-red-50 text-red-800",
  warning: "border-amber-300 bg-amber-50 text-amber-900",
  info: "border-line bg-cream text-muted",
};

export function ConfirmationStep({
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
  sampleFee,
  total,
  issues,
  onFixInDesign,
  checklist,
  onToggleChecklistItem,
  technique,
  namesValid,
  addingToCart,
  justAdded,
  addingSample,
  sampleAdded,
  onAddToCart,
  onAddSample,
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
  sampleFee: number;
  total: number;
  issues: ValidationIssue[];
  onFixInDesign: (elemKey: string) => void;
  // Was three separate items (names, logo, print area) — merged into one
  // per request, to cut down on scrolling on this step.
  checklist: { confirmed: boolean };
  onToggleChecklistItem: () => void;
  technique: string | null;
  namesValid: boolean;
  addingToCart: boolean;
  justAdded: boolean;
  addingSample: boolean;
  sampleAdded: boolean;
  onAddToCart: () => void;
  onAddSample: () => void;
}) {
  const checklistConfirmed = checklist.confirmed;
  const blockingIssues = issues.filter((i) => i.level === "blocking");
  const otherIssues = issues.filter((i) => i.level !== "blocking");
  const cartDisabled = addingToCart || !namesValid || quantityBelowMinimum || !checklistConfirmed;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-3xl mb-2">{productName}</h1>
        <p className="text-xl mb-1">
          {formatUSD(unitPrice)} <span className="text-sm text-muted font-normal">per piece · min {minOrder}</span>
        </p>
        {technique && <p className="text-sm text-muted mb-1">Technique: {technique}</p>}
        {productionTime && <p className="text-sm text-muted mb-3">Production time: {productionTime}</p>}
        <p className="text-muted">{productDescription}</p>
      </div>

      {issues.length > 0 && (
        <div className="flex flex-col gap-2" role="alert" aria-live="polite">
          {[...blockingIssues, ...otherIssues].map((issue, i) => (
            <div key={i} className={`rounded-lg border px-4 py-3 text-sm flex items-start justify-between gap-3 ${LEVEL_STYLES[issue.level]}`}>
              <span>{issue.message}</span>
              {issue.elemKey && (
                <button type="button" onClick={() => onFixInDesign(issue.elemKey!)} className="shrink-0 underline underline-offset-2 font-medium">
                  Fix in the design
                </button>
              )}
            </div>
          ))}
        </div>
      )}

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
          <label htmlFor="confirmation-quantity-input" className="text-xs uppercase tracking-wide text-muted">
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
              id="confirmation-quantity-input"
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
              <span className="text-[10px] uppercase tracking-wide opacity-80">
                {formatUSD(unitPrice)}/ea · {formatUSD(unitPrice * q)}
              </span>
              {q === popularQty && (
                <span className={`text-[10px] uppercase tracking-wide ${quantity === q ? "text-cream-light/70" : "text-terracotta"}`}>Popular</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h2 className="font-serif text-xl mb-3">Before you confirm</h2>
        <label className="flex items-start gap-3 rounded-lg border border-line p-3 cursor-pointer">
          <input type="checkbox" checked={checklist.confirmed} onChange={onToggleChecklistItem} className="mt-0.5 h-5 w-5" />
          <span className="text-sm">
            Names and date are spelled correctly, the logo is the right one and looks correct, and everything is
            inside the print area
          </span>
        </label>
        {!checklistConfirmed && <p className="text-xs text-muted mt-2">Confirm before adding to cart.</p>}
      </div>

      <div className="rounded-xl bg-cream p-6">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-muted">Quantity</span>
          <span className="text-sm font-medium">{quantity}</span>
        </div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-muted">Unit price</span>
          <span className="text-sm font-medium">{formatUSD(unitPrice)}</span>
        </div>
        <div className="flex items-center justify-between pt-2 mt-2 border-t border-line/60">
          <span className="font-serif text-2xl">Total</span>
          <span className="font-serif text-2xl">{formatUSD(total)}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={onAddToCart}
        disabled={cartDisabled}
        aria-describedby={!checklistConfirmed ? "confirmation-checklist-note" : undefined}
        className="px-6 py-3 rounded-full bg-terracotta text-cream-light text-sm font-medium hover:bg-terracotta-dark transition-colors disabled:opacity-50"
      >
        {addingToCart ? "Adding…" : justAdded ? "Added ✓" : "Add to Cart"}
      </button>
      <span id="confirmation-checklist-note" className="sr-only">
        Confirm the checklist above before adding to cart.
      </span>
      {allowSample && (
        <button
          type="button"
          onClick={onAddSample}
          disabled={addingSample || !namesValid || !checklistConfirmed}
          className="px-6 py-3 rounded-full border border-line text-sm font-medium hover:border-terracotta hover:text-terracotta transition-colors disabled:opacity-50"
        >
          {addingSample ? "Adding…" : sampleAdded ? "Sample added ✓" : `Buy 1 sample — +${formatUSD(sampleFee)}`}
        </button>
      )}
    </div>
  );
}
