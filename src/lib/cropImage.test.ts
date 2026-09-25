import { describe, it, expect } from "vitest";
import { clampCropRect, cropRectToPixels } from "./cropImage";

describe("clampCropRect", () => {
  it("leaves a valid in-bounds rect unchanged", () => {
    expect(clampCropRect({ x: 0.1, y: 0.2, width: 0.5, height: 0.5 })).toEqual({
      x: 0.1,
      y: 0.2,
      width: 0.5,
      height: 0.5,
    });
  });

  it("keeps the rect inside 0-1 by adjusting position, not shrinking size", () => {
    expect(clampCropRect({ x: 0.8, y: 0, width: 0.5, height: 0.5 })).toEqual({
      x: 0.5,
      y: 0,
      width: 0.5,
      height: 0.5,
    });
  });

  it("enforces a minimum size", () => {
    const rect = clampCropRect({ x: 0.5, y: 0.5, width: 0.01, height: 0.01 });
    expect(rect.width).toBeGreaterThanOrEqual(0.05);
    expect(rect.height).toBeGreaterThanOrEqual(0.05);
  });

  it("caps size at the full image", () => {
    const rect = clampCropRect({ x: 0, y: 0, width: 2, height: 2 });
    expect(rect.width).toBe(1);
    expect(rect.height).toBe(1);
  });
});

describe("cropRectToPixels", () => {
  it("converts fractional coordinates to rounded pixel coordinates", () => {
    expect(cropRectToPixels({ x: 0.25, y: 0.5, width: 0.5, height: 0.25 }, 400, 200)).toEqual({
      x: 100,
      y: 100,
      width: 200,
      height: 50,
    });
  });
});
