// Shared day-range formatting for a product's production lead time — used
// both on the product page (before a customer commits to an order) and in
// the cart (as a delivery estimate), so the two never phrase the same
// numbers differently.
export function leadTimeRange(min: number | null | undefined, max: number | null | undefined): string | null {
  if (min == null || max == null) return null;
  return min === max ? `${min} days` : `${min}–${max} days`;
}
