// Default (and "Reset positions") layout for the 4 personalization
// elements — BUG-06. Kept independent of ProductConfigurator so it's a pure,
// testable function of the product's own print-area configuration, per the
// package's rule that product constraints are the source of truth.

export type ElemKey = "logo" | "monogram" | "names" | "date";
export type ElemPos = { x: number; y: number };

// The generous, tall-print-area layout every product used unconditionally
// before this fix — still correct for most zones (Tote Example, Sidney Bag,
// Silken Candel, Coaster Bamboo all have enough vertical mm for it).
export const GENEROUS_DEFAULT_POSITIONS: Record<ElemKey, ElemPos> = {
  monogram: { x: 50, y: 15 },
  logo: { x: 50, y: 35 },
  names: { x: 50, y: 65 },
  date: { x: 50, y: 82 },
};

// Below this real-world height, a vertical stack of monogram/logo above
// names above date doesn't have enough physical room for the names and date
// text blocks to clear each other — this is the exact shape of the reported
// overlap (Sláinte twoinone's print area is 40×20mm; every other product
// reviewed is 50mm or taller). Chosen from the actual print-area heights of
// the 5 products this package covers, not an arbitrary guess: every other
// named product's zone is comfortably above it.
const SHORT_ZONE_HEIGHT_MM = 30;

// A print area this short lays names and date side by side instead of
// stacked — that avoids the vertical crowding entirely, regardless of the
// exact font size a given browser/zoom level renders (which the on-screen
// pixel size, not just the zone's mm dimensions, ultimately determines).
// Monogram/logo stay centered above both, out of the way.
const SHORT_ZONE_DEFAULT_POSITIONS: Record<ElemKey, ElemPos> = {
  monogram: { x: 50, y: 14 },
  logo: { x: 50, y: 14 },
  names: { x: 32, y: 62 },
  date: { x: 72, y: 62 },
};

export function computeDefaultPositions(
  zone?: { width_mm: number | null; height_mm: number | null } | null
): Record<ElemKey, ElemPos> {
  const heightMm = zone?.height_mm ?? null;
  if (heightMm != null && heightMm <= SHORT_ZONE_HEIGHT_MM) {
    return SHORT_ZONE_DEFAULT_POSITIONS;
  }
  return GENEROUS_DEFAULT_POSITIONS;
}
