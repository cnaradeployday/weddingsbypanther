// Quantity-field validation — BUG-09. A value below the product's minimum
// (or not a valid positive integer) is never silently corrected to the
// minimum; it's reported so the field can show why and the cart buttons can
// disable, while the raw text the shopper typed is left exactly as-is.

export function parseQuantityInput(rawInput: string): number | null {
  const trimmed = rawInput.trim();
  if (trimmed === "") return null;
  const parsed = Math.round(Number(trimmed));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

// True whenever the typed quantity can't be ordered as-is: not a valid
// positive whole number, or below the product's minimum order.
export function isQuantityBelowMinimum(rawInput: string, minOrder: number): boolean {
  const parsed = parseQuantityInput(rawInput);
  return parsed === null || parsed < minOrder;
}
