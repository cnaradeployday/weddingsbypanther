import { describe, it, expect } from "vitest";
import { estimatePrintDpi, estimateLogoFootprintMm, MIN_PRINT_DPI } from "./logoPrintQuality";

describe("estimatePrintDpi", () => {
  it("computes dpi from pixel width and a physical footprint", () => {
    // 300px wide over a 1-inch (25.4mm) footprint is exactly 300dpi.
    expect(estimatePrintDpi(300, 25.4)).toBeCloseTo(300, 5);
  });

  it("returns null when either input is missing or non-positive", () => {
    expect(estimatePrintDpi(0, 25.4)).toBeNull();
    expect(estimatePrintDpi(300, 0)).toBeNull();
    expect(estimatePrintDpi(300, -5)).toBeNull();
  });

  it("flags a logo below the accepted floor", () => {
    const dpi = estimatePrintDpi(100, 50);
    expect(dpi).not.toBeNull();
    expect(dpi!).toBeLessThan(MIN_PRINT_DPI);
  });
});

describe("estimateLogoFootprintMm", () => {
  it("is 45% of the zone's smaller physical dimension, scaled by elemScale", () => {
    expect(estimateLogoFootprintMm({ width_mm: 100, height_mm: 60 }, 1)).toBeCloseTo(60 * 0.45, 5);
    expect(estimateLogoFootprintMm({ width_mm: 100, height_mm: 60 }, 2)).toBeCloseTo(60 * 0.45 * 2, 5);
  });

  it("returns null when the zone has no mm dimensions on file", () => {
    expect(estimateLogoFootprintMm({ width_mm: null, height_mm: 60 }, 1)).toBeNull();
    expect(estimateLogoFootprintMm(null, 1)).toBeNull();
    expect(estimateLogoFootprintMm(undefined, 1)).toBeNull();
  });
});
