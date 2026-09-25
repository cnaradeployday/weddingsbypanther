import { describe, it, expect } from "vitest";
import { letterSpacingEm, lineHeightMultiplier, curveTextPath } from "./textStyle";

describe("letterSpacingEm", () => {
  it("maps 0 to no extra spacing and 100 to the widest value", () => {
    expect(letterSpacingEm(0)).toBe(0);
    expect(letterSpacingEm(100)).toBeCloseTo(0.25);
  });

  it("clamps out-of-range input", () => {
    expect(letterSpacingEm(-10)).toBe(0);
    expect(letterSpacingEm(150)).toBeCloseTo(0.25);
  });
});

describe("lineHeightMultiplier", () => {
  it("maps 0 to tight and 100 to loose", () => {
    expect(lineHeightMultiplier(0)).toBe(1);
    expect(lineHeightMultiplier(100)).toBe(2.5);
  });
});

describe("curveTextPath", () => {
  it("is a straight horizontal line at curve 0", () => {
    const path = curveTextPath(0, 200, 40);
    expect(path).toBe("M 0,20 Q 100,20 200,20");
  });

  it("arcs upward (smaller y at the control point) for positive curve", () => {
    const path = curveTextPath(50, 200, 40);
    const controlY = Number(path.match(/Q [\d.]+,([\d.-]+)/)?.[1]);
    expect(controlY).toBeLessThan(20);
  });

  it("arcs downward (larger y at the control point) for negative curve", () => {
    const path = curveTextPath(-50, 200, 40);
    const controlY = Number(path.match(/Q [\d.]+,([\d.-]+)/)?.[1]);
    expect(controlY).toBeGreaterThan(20);
  });

  it("bulges further for a larger magnitude", () => {
    const small = curveTextPath(20, 200, 40);
    const large = curveTextPath(80, 200, 40);
    const smallY = Number(small.match(/Q [\d.]+,([\d.-]+)/)?.[1]);
    const largeY = Number(large.match(/Q [\d.]+,([\d.-]+)/)?.[1]);
    expect(20 - largeY).toBeGreaterThan(20 - smallY);
  });

  it("clamps curve beyond ±100", () => {
    expect(curveTextPath(500, 200, 40)).toBe(curveTextPath(100, 200, 40));
    expect(curveTextPath(-500, 200, 40)).toBe(curveTextPath(-100, 200, 40));
  });
});
