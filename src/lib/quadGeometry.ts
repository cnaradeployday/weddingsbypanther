export type Point = { x: number; y: number };

export function boundingBox(corners: Point[]) {
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  return { left, top, width: Math.max(...xs) - left, height: Math.max(...ys) - top };
}

// Expresses `point` in the quad's own affine (u,v) parametric coordinates —
// u=0..1 along the TL->TR edge, v=0..1 along the TL->BL edge — treating the
// quad as a parallelogram (basis TL, TR, BL; BR is ignored, the same
// simplification already used elsewhere to derive a single rotation angle
// from just the TL->TR edge). This inverts the perspective/rotation
// distortion baked into corners_pct by the angle the reference photo was
// shot at, recovering where a point truly sits on the real, flat print
// surface — needed for output (like the print-ready outline file) that
// isn't itself drawn over that photo, so it can't lean on the same
// AABB-plus-rotation approximation the on-photo overlay and composite use.
export function quadUV(point: Point, corners: Point[]): { u: number; v: number } {
  if (corners.length !== 4) return { u: 0.5, v: 0.5 };
  const [tl, tr, , bl] = corners;
  const ex = { x: tr.x - tl.x, y: tr.y - tl.y };
  const ey = { x: bl.x - tl.x, y: bl.y - tl.y };
  const dx = point.x - tl.x;
  const dy = point.y - tl.y;
  const det = ex.x * ey.y - ey.x * ex.y;
  if (Math.abs(det) < 1e-9) return { u: 0.5, v: 0.5 };
  return {
    u: (dx * ey.y - ey.x * dy) / det,
    v: (ex.x * dy - dx * ex.y) / det,
  };
}

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

// Inward unit normal + a reference point on each of the quad's 4 edges —
// the sign is corrected against the quad's own centroid so it works
// regardless of winding order. Shared by every function below that measures
// distance to the quad's boundary.
function inwardEdges(corners: Point[]): { a: Point; nx: number; ny: number }[] {
  const centroid = {
    x: (corners[0].x + corners[1].x + corners[2].x + corners[3].x) / 4,
    y: (corners[0].y + corners[1].y + corners[2].y + corners[3].y) / 4,
  };
  const edges: { a: Point; nx: number; ny: number }[] = [];
  for (let i = 0; i < 4; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % 4];
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const len = Math.hypot(ex, ey);
    if (len < 1e-9) continue;
    let nx = -ey / len;
    let ny = ex / len;
    if ((centroid.x - a.x) * nx + (centroid.y - a.y) * ny < 0) {
      nx = -nx;
      ny = -ny;
    }
    edges.push({ a, nx, ny });
  }
  return edges;
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
    for (const { a, nx, ny } of inwardEdges(corners)) {
      const dist = (p.x - a.x) * nx + (p.y - a.y) * ny;
      if (dist < margin) {
        const push = margin - dist;
        p = { x: p.x + nx * push, y: p.y + ny * push };
      }
    }
  }
  return p;
}

// How far a `halfW`x`halfH` box, rotated by `rotationRad` and centered at
// the origin, extends toward unit direction (nx, ny) — the standard support
// function of an oriented rectangle. Used below instead of a single
// circular margin, which either clamps a tilted element's drag/resize far
// too early along its short axis or lets it cross the boundary along its
// long axis, depending on how the print area itself is inclined.
function boxSupport(halfW: number, halfH: number, rotationRad: number, nx: number, ny: number): number {
  const cos = Math.cos(rotationRad);
  const sin = Math.sin(rotationRad);
  const localX = nx * cos + ny * sin;
  const localY = -nx * sin + ny * cos;
  return halfW * Math.abs(localX) + halfH * Math.abs(localY);
}

// Clamps `center` so a `halfW`x`halfH` box rotated by `rotationRad` and
// centered there stays inside the quad — the rotation-aware sibling of
// clampPointToQuad's scalar-margin version, for a dragged element that's
// tilted to match an angled print area.
export function clampOrientedBoxToQuad(
  center: Point,
  corners: Point[],
  halfW: number,
  halfH: number,
  rotationRad: number
): Point {
  if (corners.length !== 4) return center;
  let p = center;
  for (let pass = 0; pass < 4; pass++) {
    for (const { a, nx, ny } of inwardEdges(corners)) {
      const margin = boxSupport(halfW, halfH, rotationRad, nx, ny);
      const dist = (p.x - a.x) * nx + (p.y - a.y) * ny;
      if (dist < margin) {
        const push = margin - dist;
        p = { x: p.x + nx * push, y: p.y + ny * push };
      }
    }
  }
  return p;
}

// Largest uniform scale multiplier (applied to both halfW and halfH at
// once, relative to their current size) that keeps a box of that size,
// rotated by `rotationRad` and centered at `center`, inside the quad.
// Replaces a single conservative nearestEdgeDistance-based radius, which
// under-caps a box that's aligned with the print area's own tilt (it always
// assumed the box could need equal room in every direction).
export function maxOrientedBoxScale(
  center: Point,
  corners: Point[],
  halfW: number,
  halfH: number,
  rotationRad: number
): number {
  if (corners.length !== 4 || halfW <= 0 || halfH <= 0) return Infinity;
  let best = Infinity;
  for (const { a, nx, ny } of inwardEdges(corners)) {
    const dist = (center.x - a.x) * nx + (center.y - a.y) * ny;
    const support = boxSupport(halfW, halfH, rotationRad, nx, ny);
    if (support < 1e-9) continue;
    best = Math.min(best, dist / support);
  }
  return best;
}
