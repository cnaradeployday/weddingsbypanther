export type Point = { x: number; y: number };

// Distance (same units as the input points) from `origin` to the nearest
// edge of a convex quad, travelling along direction `dir` — i.e. the `t`
// such that origin + t*dir lands exactly on the quad's boundary. Returns
// Infinity if the ray never exits through one of the 4 edges (shouldn't
// happen for a point inside a proper convex quad, but corners can in
// principle be dragged into a degenerate/self-intersecting shape).
export function rayDistanceToQuad(origin: Point, dir: Point, corners: Point[]): number {
  if (corners.length !== 4) return Infinity;
  let best = Infinity;
  for (let i = 0; i < 4; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % 4];
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const denom = dir.x * ey - dir.y * ex;
    if (Math.abs(denom) < 1e-9) continue; // parallel to this edge
    const t = ((a.x - origin.x) * ey - (a.y - origin.y) * ex) / denom;
    const s = ((a.x - origin.x) * dir.y - (a.y - origin.y) * dir.x) / denom;
    if (t > 1e-6 && s >= -1e-6 && s <= 1 + 1e-6 && t < best) best = t;
  }
  return best;
}

// The room available around `origin` along a full axis (both directions of
// `dir`) — the smaller of the two opposite rays, since growing or moving
// along that axis must stay clear of whichever side is closer. `dir`
// doesn't need to be a unit vector; the axis it defines is what matters.
export function availableAlongAxis(origin: Point, dir: Point, corners: Point[]): number {
  const forward = rayDistanceToQuad(origin, dir, corners);
  const backward = rayDistanceToQuad(origin, { x: -dir.x, y: -dir.y }, corners);
  return Math.min(forward, backward);
}

// A conservative single radius: the nearest distance from `origin` to any
// of the quad's 4 edges, in any direction. Safe to use as a uniform cap
// (e.g. for a resize handle that must not cross the boundary in *any*
// direction at once), but more conservative than availableAlongAxis for a
// specific direction — a point near a corner has a small "nearest edge"
// distance even though there's more room along, say, the diagonal toward
// the opposite corner.
export function nearestEdgeDistance(origin: Point, corners: Point[]): number {
  if (corners.length !== 4) return Infinity;
  let best = Infinity;
  for (let i = 0; i < 4; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % 4];
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const len = Math.hypot(ex, ey);
    if (len < 1e-9) continue;
    const dist = Math.abs((origin.x - a.x) * ey - (origin.y - a.y) * ex) / len;
    best = Math.min(best, dist);
  }
  return best;
}

// Clamps `point` to stay inside the convex quad (respecting `margin` —
// e.g. half of a dragged element's own size — from every edge), by
// projecting it inward along each violated edge's normal in turn. A few
// passes converge for a 4-sided convex shape; this is the standard
// iterative approach to clamping a point into a convex polygon.
export function clampPointToQuad(point: Point, corners: Point[], margin = 0): Point {
  if (corners.length !== 4) return point;
  let p = point;
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 0; i < 4; i++) {
      const a = corners[i];
      const b = corners[(i + 1) % 4];
      const ex = b.x - a.x;
      const ey = b.y - a.y;
      const len = Math.hypot(ex, ey);
      if (len < 1e-9) continue;
      // Inward normal — corners are wound so the quad's interior is
      // consistently on one side; probe with the quad's own centroid to
      // pick the sign that points inward regardless of winding order.
      const centroid = {
        x: (corners[0].x + corners[1].x + corners[2].x + corners[3].x) / 4,
        y: (corners[0].y + corners[1].y + corners[2].y + corners[3].y) / 4,
      };
      let nx = -ey / len;
      let ny = ex / len;
      const centroidSide = (centroid.x - a.x) * nx + (centroid.y - a.y) * ny;
      if (centroidSide < 0) {
        nx = -nx;
        ny = -ny;
      }
      const dist = (p.x - a.x) * nx + (p.y - a.y) * ny;
      if (dist < margin) {
        const push = margin - dist;
        p = { x: p.x + nx * push, y: p.y + ny * push };
      }
    }
  }
  return p;
}
