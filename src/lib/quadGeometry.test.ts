import { describe, it, expect } from "vitest";
import {
  boundingBox,
  clampPointToQuad,
  clampOrientedBoxToQuad,
  maxOrientedBoxScale,
  resolveRotatedContainment,
  type Point,
} from "./quadGeometry";

// A plain axis-aligned 100x100 square, TL/TR/BR/BL winding — mirrors
// corners_pct shape but in an arbitrary "px" unit for readability.
const SQUARE: Point[] = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
];

// Checks that every corner of a halfW/halfH box centered at `center` and
// rotated by `rotationRad` lies inside (or on) the convex quad — the same
// "no part of the element outside the print area" property BUG-03's
// acceptance criteria asks for, verified directly against the box's real
// rotated corners rather than trusting the containment helpers themselves.
function isBoxFullyInsideQuad(
  center: Point,
  corners: Point[],
  halfW: number,
  halfH: number,
  rotationRad: number,
  epsilon = 1e-6
): boolean {
  const cos = Math.cos(rotationRad);
  const sin = Math.sin(rotationRad);
  const localCorners: Point[] = [
    { x: -halfW, y: -halfH },
    { x: halfW, y: -halfH },
    { x: halfW, y: halfH },
    { x: -halfW, y: halfH },
  ];
  const boxCorners = localCorners.map(({ x, y }) => ({
    x: center.x + x * cos - y * sin,
    y: center.y + x * sin + y * cos,
  }));

  // Point-in-convex-polygon via the same inward-normal test the geometry
  // module itself uses (recomputed independently here, not imported, so
  // this check doesn't just restate the implementation under test).
  const centroid = {
    x: corners.reduce((s, c) => s + c.x, 0) / 4,
    y: corners.reduce((s, c) => s + c.y, 0) / 4,
  };
  return boxCorners.every((pt) =>
    corners.every((a, i) => {
      const b = corners[(i + 1) % 4];
      let nx = -(b.y - a.y);
      let ny = b.x - a.x;
      const len = Math.hypot(nx, ny) || 1;
      nx /= len;
      ny /= len;
      if ((centroid.x - a.x) * nx + (centroid.y - a.y) * ny < 0) {
        nx = -nx;
        ny = -ny;
      }
      return (pt.x - a.x) * nx + (pt.y - a.y) * ny >= -epsilon;
    })
  );
}

describe("boundingBox", () => {
  it("computes the axis-aligned box of a set of corners", () => {
    expect(boundingBox(SQUARE)).toEqual({ left: 0, top: 0, width: 100, height: 100 });
  });
});

describe("clampPointToQuad", () => {
  it("leaves an already-interior point untouched", () => {
    expect(clampPointToQuad({ x: 50, y: 50 }, SQUARE)).toEqual({ x: 50, y: 50 });
  });

  it("pushes an exterior point back inside", () => {
    const p = clampPointToQuad({ x: 150, y: 50 }, SQUARE);
    expect(p.x).toBeLessThanOrEqual(100);
    expect(p.x).toBeGreaterThan(50);
  });
});

describe("clampOrientedBoxToQuad / maxOrientedBoxScale — BUG-03 move & resize", () => {
  it("keeps an unrotated centered box's containment unchanged", () => {
    const p = clampOrientedBoxToQuad({ x: 50, y: 50 }, SQUARE, 20, 20, 0);
    expect(p).toEqual({ x: 50, y: 50 });
    expect(isBoxFullyInsideQuad(p, SQUARE, 20, 20, 0)).toBe(true);
  });

  it("pulls a box back in when dragged near an edge", () => {
    const p = clampOrientedBoxToQuad({ x: 95, y: 50 }, SQUARE, 20, 20, 0);
    expect(isBoxFullyInsideQuad(p, SQUARE, 20, 20, 0)).toBe(true);
  });

  it("accounts for rotation when clamping a dragged box near an edge", () => {
    // A 30x10 box rotated 45° has a much larger rotated footprint than its
    // unrotated one — clamping must use the rotated footprint, not the
    // unrotated halfW/halfH, or part of it would cross the boundary.
    const rot = Math.PI / 4;
    const p = clampOrientedBoxToQuad({ x: 90, y: 50 }, SQUARE, 15, 5, rot);
    expect(isBoxFullyInsideQuad(p, SQUARE, 15, 5, rot)).toBe(true);
  });

  it("reports a smaller max scale for a box rotated toward a corner", () => {
    const unrotated = maxOrientedBoxScale({ x: 50, y: 50 }, SQUARE, 10, 10, 0);
    const rotated = maxOrientedBoxScale({ x: 50, y: 50 }, SQUARE, 10, 10, Math.PI / 4);
    // A square box's footprint only grows under rotation, so the safe
    // growth multiplier can only shrink or stay the same.
    expect(rotated).toBeLessThanOrEqual(unrotated);
  });
});

describe("resolveRotatedContainment — BUG-03 rotate", () => {
  it("leaves a box that still fits after rotating untouched", () => {
    const result = resolveRotatedContainment({ x: 50, y: 50 }, SQUARE, 10, 10, Math.PI / 6);
    expect(result.resized).toBe(false);
    expect(result.scale).toBe(1);
    expect(isBoxFullyInsideQuad(result.center, SQUARE, 10, 10, Math.PI / 6)).toBe(true);
  });

  it("moves a box back inside when rotation pushes it past a nearby edge", () => {
    // Centered close to the right edge: fits unrotated, but a 45° rotation
    // makes its footprint reach past x=100 unless re-clamped.
    const center = { x: 92, y: 50 };
    const rot = Math.PI / 4;
    const before = isBoxFullyInsideQuad(center, SQUARE, 12, 6, rot);
    expect(before).toBe(false); // sanity: this case really does violate the boundary pre-fix

    const result = resolveRotatedContainment(center, SQUARE, 12, 6, rot);
    expect(isBoxFullyInsideQuad(result.center, SQUARE, 12, 6, rot)).toBe(true);
  });

  it("shrinks a box that can't fit at its current size no matter where it's centered", () => {
    // A box bigger than the quad itself along its rotated diagonal — no
    // repositioning alone can make this fit, so it must be scaled down.
    const center = { x: 50, y: 50 };
    const rot = Math.PI / 4;
    const result = resolveRotatedContainment(center, SQUARE, 90, 90, rot);
    expect(result.resized).toBe(true);
    expect(result.scale).toBeLessThan(1);
    expect(result.scale).toBeGreaterThan(0);
    expect(
      isBoxFullyInsideQuad(result.center, SQUARE, 90 * result.scale, 90 * result.scale, rot)
    ).toBe(true);
  });

  it("never leaves any part of the element outside the print area, across many rotations", () => {
    // Sweeps a range of starting positions/sizes/rotations — the exact
    // acceptance criterion from 01-bug-fixes.md ("no combination of move,
    // resize and rotate leaves any part of an element outside the print
    // area"), scoped to the rotate step this bug is about.
    const starts: Point[] = [
      { x: 50, y: 50 },
      { x: 85, y: 50 },
      { x: 15, y: 15 },
      { x: 90, y: 90 },
      { x: 50, y: 10 },
    ];
    const sizes = [
      { halfW: 5, halfH: 5 },
      { halfW: 20, halfH: 8 },
      { halfW: 8, halfH: 20 },
    ];
    for (const center of starts) {
      for (const { halfW, halfH } of sizes) {
        for (let deg = -45; deg <= 45; deg += 15) {
          const rot = (deg * Math.PI) / 180;
          const result = resolveRotatedContainment(center, SQUARE, halfW, halfH, rot);
          const finalHalfW = halfW * result.scale;
          const finalHalfH = halfH * result.scale;
          expect(isBoxFullyInsideQuad(result.center, SQUARE, finalHalfW, finalHalfH, rot)).toBe(
            true
          );
        }
      }
    }
  });

  it("is a no-op on a degenerate (non-4-corner) quad", () => {
    const result = resolveRotatedContainment({ x: 50, y: 50 }, [], 10, 10, Math.PI / 4);
    expect(result).toEqual({ center: { x: 50, y: 50 }, scale: 1, resized: false });
  });
});
