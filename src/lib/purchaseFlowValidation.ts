// FLOW-06's validation engine — three levels (blocking / warning / info),
// reusing BUG-02's names check and BUG-09's quantity check rather than
// re-implementing them. Takes plain, already-computed values instead of the
// editor's own `Design`/DOM state so it stays a portable, easily testable
// function with no dependency on the component tree (same reasoning as
// designStorage.ts's separately-defined types).
//
// Two of the doc's example conditions are deliberately not implemented here
// — see DISCOVERY.md's Gaps:
// - "Element outside the print area": BUG-03's containment is enforced
//   unconditionally on every drag/resize/rotate (and by Reset positions),
//   so a design reaching Review can't actually be outside the print area
//   through the editor's own UI — there's nothing left to re-check.
// - "Color not allowed for the technique" / "QR below minimum size": no
//   config value for either exists (DISCOVERY.md gaps #2–3) — the only
//   color restriction the schema supports (single-color-ink) is already
//   enforced live by the color pickers themselves, and there's no QR
//   minimum-size constant to check against.
import { isNamesValid } from "./personalizationValidation";
import { isQuantityBelowMinimum } from "./quantityValidation";

export type ValidationLevel = "blocking" | "warning" | "info";

export type ValidationIssue = {
  level: ValidationLevel;
  // The design element this issue is about, if any — used to render the
  // "Fix in the design" link and the on-canvas badge (FLOW-06).
  elemKey?: string;
  message: string;
};

export function computeValidationIssues({
  names,
  quantityInput,
  minOrder,
  checklistConfirmed,
  hasLogo,
  logoIsLowRes,
  hiddenElements,
}: {
  names: string;
  quantityInput: string;
  minOrder: number;
  checklistConfirmed: boolean;
  hasLogo: boolean;
  logoIsLowRes: boolean;
  // Present-but-hidden elements (EDIT-14) — hidden means "won't be
  // printed" (02-editor-tools.md EDIT-14), which is worth surfacing before
  // checkout even though it isn't blocking.
  hiddenElements: { key: string; label: string }[];
}): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!isNamesValid(names)) {
    issues.push({ level: "blocking", elemKey: "names", message: "Add your names or event text before ordering." });
  }
  if (isQuantityBelowMinimum(quantityInput, minOrder)) {
    issues.push({ level: "blocking", message: `The minimum order is ${minOrder} units.` });
  }
  if (!checklistConfirmed) {
    issues.push({ level: "blocking", message: "Confirm the checklist below before ordering." });
  }

  if (hasLogo && logoIsLowRes) {
    issues.push({
      level: "warning",
      elemKey: "logo",
      message: "This logo is low resolution — it may look blurry or pixelated on the finished product.",
    });
  }
  for (const { key, label } of hiddenElements) {
    issues.push({ level: "warning", elemKey: key, message: `${label} is hidden and won't be printed.` });
  }

  if (!hasLogo) {
    issues.push({ level: "info", message: "No logo added — this is optional." });
  }

  return issues;
}

export function hasBlockingIssues(issues: ValidationIssue[]): boolean {
  return issues.some((i) => i.level === "blocking");
}
