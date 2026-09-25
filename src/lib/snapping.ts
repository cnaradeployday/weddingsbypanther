// Snapping while dragging (EDIT-03) — "to the center lines and edges of the
// print area, and to the centers and edges of other elements." Pure
// geometry: given a candidate point and a list of horizontal/vertical
// target lines (already computed by the caller from the print area's quad
// and the other elements' current boxes, in the same px space as the
// candidate), finds the nearest target within `threshold` on each axis
// independently and reports which line (if any) it snapped to, so the
// caller can both adjust the position and draw the snap-line indicator.

export type SnapResult = {
  x: number;
  y: number;
  snappedToX: number | null;
  snappedToY: number | null;
};

function nearestWithinThreshold(value: number, targets: number[], threshold: number): number | null {
  let best: number | null = null;
  let bestDist = threshold;
  for (const t of targets) {
    const dist = Math.abs(value - t);
    if (dist <= bestDist) {
      best = t;
      bestDist = dist;
    }
  }
  return best;
}

export function computeSnap(
  candidate: { x: number; y: number },
  targetsX: number[],
  targetsY: number[],
  threshold: number
): SnapResult {
  const snappedToX = nearestWithinThreshold(candidate.x, targetsX, threshold);
  const snappedToY = nearestWithinThreshold(candidate.y, targetsY, threshold);
  return {
    x: snappedToX ?? candidate.x,
    y: snappedToY ?? candidate.y,
    snappedToX,
    snappedToY,
  };
}

// Builds the snap targets for one axis from a box's edges + center — used
// for both the print area (one box) and every other element's current box
// (one set of targets each), so a dragged element's own center or either
// edge can land on any of those lines.
export function boxSnapTargets(min: number, max: number): number[] {
  return [min, (min + max) / 2, max];
}
