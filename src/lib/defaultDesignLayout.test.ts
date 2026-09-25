import { describe, it, expect } from "vitest";
import { computeDefaultPositions, GENEROUS_DEFAULT_POSITIONS } from "./defaultDesignLayout";

// Real print-area dimensions for the 5 products 01-bug-fixes.md (BUG-06)
// names, from product_print_zones — confirmed directly against the
// project's own Supabase data, not invented.
const REAL_ZONES = {
  toteExample: { width_mm: 220, height_mm: 220 },
  sidneyBag: { width_mm: 150, height_mm: 50 },
  silkenCandel: { width_mm: 50, height_mm: 50 },
  coasterBamboo: { width_mm: 60, height_mm: 60 },
  slainteTwoinone: { width_mm: 40, height_mm: 20 },
};

describe("computeDefaultPositions", () => {
  it("falls back to the generous stacked layout with no zone info", () => {
    expect(computeDefaultPositions(undefined)).toEqual(GENEROUS_DEFAULT_POSITIONS);
    expect(computeDefaultPositions(null)).toEqual(GENEROUS_DEFAULT_POSITIONS);
    expect(computeDefaultPositions({ width_mm: null, height_mm: null })).toEqual(
      GENEROUS_DEFAULT_POSITIONS
    );
  });

  it("uses the generous stacked layout for Tote Example, Sidney Bag, Silken Candel and Coaster Bamboo", () => {
    for (const zone of [
      REAL_ZONES.toteExample,
      REAL_ZONES.sidneyBag,
      REAL_ZONES.silkenCandel,
      REAL_ZONES.coasterBamboo,
    ]) {
      expect(computeDefaultPositions(zone)).toEqual(GENEROUS_DEFAULT_POSITIONS);
    }
  });

  it("switches Sláinte twoinone's 40×20mm zone to a side-by-side layout", () => {
    const pos = computeDefaultPositions(REAL_ZONES.slainteTwoinone);
    expect(pos).not.toEqual(GENEROUS_DEFAULT_POSITIONS);
    // Side by side: different x, same y — never stacked close enough to
    // overlap vertically the way the generous layout's fixed 17-point gap
    // did on this product.
    expect(pos.names.x).not.toBe(pos.date.x);
    expect(pos.names.y).toBe(pos.date.y);
  });

  it("keeps every element's default position inside the print area (0-100)", () => {
    for (const zone of Object.values(REAL_ZONES)) {
      const pos = computeDefaultPositions(zone);
      for (const key of ["monogram", "logo", "names", "date"] as const) {
        expect(pos[key].x).toBeGreaterThanOrEqual(0);
        expect(pos[key].x).toBeLessThanOrEqual(100);
        expect(pos[key].y).toBeGreaterThanOrEqual(0);
        expect(pos[key].y).toBeLessThanOrEqual(100);
      }
    }
  });

  it("treats the threshold as a real-world height, not an aspect ratio", () => {
    // Sidney Bag (150x50mm) is proportionally MUCH wider/shorter than
    // Sláinte (40x20mm — a 2:1 ratio vs Sidney's 3:1), but its absolute
    // 50mm height is tall enough to stack safely, so it must stay on the
    // generous layout while Sláinte's absolute 20mm doesn't.
    expect(computeDefaultPositions(REAL_ZONES.sidneyBag)).toEqual(GENEROUS_DEFAULT_POSITIONS);
    expect(computeDefaultPositions(REAL_ZONES.slainteTwoinone)).not.toEqual(
      GENEROUS_DEFAULT_POSITIONS
    );
  });
});
