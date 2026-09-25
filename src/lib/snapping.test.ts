import { describe, it, expect } from "vitest";
import { computeSnap, boxSnapTargets } from "./snapping";

describe("boxSnapTargets", () => {
  it("returns min, center, and max", () => {
    expect(boxSnapTargets(0, 100)).toEqual([0, 50, 100]);
  });
});

describe("computeSnap — EDIT-03", () => {
  it("snaps to the nearest target within the threshold, per axis independently", () => {
    const result = computeSnap({ x: 48, y: 203 }, [0, 50, 100], [0, 200, 400], 5);
    expect(result).toEqual({ x: 50, y: 200, snappedToX: 50, snappedToY: 200 });
  });

  it("leaves a coordinate unchanged when nothing is within the threshold", () => {
    const result = computeSnap({ x: 30, y: 30 }, [0, 50, 100], [0, 50, 100], 5);
    expect(result).toEqual({ x: 30, y: 30, snappedToX: null, snappedToY: null });
  });

  it("picks the closest target when multiple are within the threshold", () => {
    const result = computeSnap({ x: 51, y: 0 }, [45, 50, 100], [], 10);
    expect(result.snappedToX).toBe(50);
  });

  it("snaps right at the edge of the threshold (inclusive)", () => {
    const result = computeSnap({ x: 55, y: 0 }, [50], [], 5);
    expect(result.snappedToX).toBe(50);
  });

  it("does not snap just past the threshold", () => {
    const result = computeSnap({ x: 55.1, y: 0 }, [50], [], 5);
    expect(result.snappedToX).toBeNull();
  });
});
