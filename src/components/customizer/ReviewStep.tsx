"use client";

import { formatUSD } from "@/lib/format";
import type { ValidationIssue } from "@/lib/purchaseFlowValidation";

// FLOW-06 — Step 3 · Review: alerts (grouped by level), the mandatory
// checklist, a summary, and the cart actions. No safe-area field exists
// anywhere in the schema (DISCOVERY.md gap #1), so the second checklist
// item always reads "inside the print area" — the fallback the doc itself
// specifies for that gap, never invented safe-area copy.
const LEVEL_STYLES: Record<ValidationIssue["level"], string> = {
  blocking: "border-red-300 bg-red-50 text-red-800",
  warning: "border-amber-300 bg-amber-50 text-amber-900",
  info: "border-line bg-cream text-muted",
};

export function ReviewStep({
  issues,
  onFixInDesign,
  checklist,
  onToggleChecklistItem,
  technique,
  quantity,
  productionTime,
  total,
  unitPrice,
  allowSample,
  sampleFee,
  namesValid,
  quantityBelowMinimum,
  addingToCart,
  justAdded,
  addingSample,
  sampleAdded,
  onAddToCart,
  onAddSample,
  aiRenderSlot,
}: {
  issues: ValidationIssue[];
  onFixInDesign: (elemKey: string) => void;
  checklist: { namesCorrect: boolean; insidePrintArea: boolean };
  onToggleChecklistItem: (item: "namesCorrect" | "insidePrintArea") => void;
  technique: string | null;
  quantity: number;
  productionTime: string | null;
  total: number;
  unitPrice: number;
  allowSample: boolean;
  sampleFee: number;
  namesValid: boolean;
  quantityBelowMinimum: boolean;
  addingToCart: boolean;
  justAdded: boolean;
  addingSample: boolean;
  sampleAdded: boolean;
  onAddToCart: () => void;
  onAddSample: () => void;
  aiRenderSlot: React.ReactNode;
}) {
  const checklistConfirmed = checklist.namesCorrect && checklist.insidePrintArea;
  const blockingIssues = issues.filter((i) => i.level === "blocking");
  const otherIssues = issues.filter((i) => i.level !== "blocking");
  const cartDisabled = addingToCart || !namesValid || quantityBelowMinimum || !checklistConfirmed;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-serif text-3xl">Review</h1>

      {issues.length > 0 && (
        <div className="flex flex-col gap-2" role="alert" aria-live="polite">
          {[...blockingIssues, ...otherIssues].map((issue, i) => (
            <div key={i} className={`rounded-lg border px-4 py-3 text-sm flex items-start justify-between gap-3 ${LEVEL_STYLES[issue.level]}`}>
              <span>{issue.message}</span>
              {issue.elemKey && (
                <button
                  type="button"
                  onClick={() => onFixInDesign(issue.elemKey!)}
                  className="shrink-0 underline underline-offset-2 font-medium"
                >
                  Fix in the design
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {aiRenderSlot}

      <div>
        <h2 className="font-serif text-xl mb-3">Before you confirm</h2>
        <div className="flex flex-col gap-2">
          <label className="flex items-start gap-3 rounded-lg border border-line p-3 cursor-pointer">
            <input
              type="checkbox"
              checked={checklist.namesCorrect}
              onChange={() => onToggleChecklistItem("namesCorrect")}
              className="mt-0.5 h-5 w-5"
            />
            <span className="text-sm">Names and date spelled correctly</span>
          </label>
          <label className="flex items-start gap-3 rounded-lg border border-line p-3 cursor-pointer">
            <input
              type="checkbox"
              checked={checklist.insidePrintArea}
              onChange={() => onToggleChecklistItem("insidePrintArea")}
              className="mt-0.5 h-5 w-5"
            />
            <span className="text-sm">All elements inside the print area</span>
          </label>
        </div>
        {!checklistConfirmed && (
          <p className="text-xs text-muted mt-2">Confirm both items before adding to cart.</p>
        )}
      </div>

      <div className="rounded-xl bg-cream p-6">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-muted">Technique</span>
          <span className="text-sm font-medium">{technique ?? "—"}</span>
        </div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-muted">Quantity</span>
          <span className="text-sm font-medium">{quantity}</span>
        </div>
        {productionTime && (
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-muted">Production time</span>
            <span className="text-sm font-medium">{productionTime}</span>
          </div>
        )}
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
        aria-describedby={!checklistConfirmed ? "review-checklist-note" : undefined}
        className="px-6 py-3 rounded-full bg-terracotta text-cream-light text-sm font-medium hover:bg-terracotta-dark transition-colors disabled:opacity-50"
      >
        {addingToCart ? "Adding…" : justAdded ? "Added ✓" : "Add to Cart"}
      </button>
      <span id="review-checklist-note" className="sr-only">
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
