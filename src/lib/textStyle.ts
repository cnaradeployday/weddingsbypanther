// Pure conversions from the editor's 0-100 slider values (EDIT-07) to real
// CSS/SVG units — kept separate from the component so they're testable and
// so the same math can be reused server-side later if the print pipeline
// adopts curved text too.

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// 0 -> normal letter spacing, 100 -> noticeably wide (0.25em).
export function letterSpacingEm(value: number): number {
  return (clamp(value, 0, 100) / 100) * 0.25;
}

// 0 -> tight (1.0), 100 -> loose (2.5) — 0 intentionally isn't "0", multi-
// line text always needs at least single-line spacing to stay readable.
export function lineHeightMultiplier(value: number): number {
  return 1 + (clamp(value, 0, 100) / 100) * 1.5;
}

// An SVG quadratic-Bezier path for text-on-a-path (curve slider): straight
// in the middle (curve 0), arcing up for positive values, down for negative
// — matching the editor's "straight in the middle, arc up/down to each
// side" description. A quadratic bulge rather than a true circular arc:
// visually equivalent at the moderate bulge amounts a UI slider produces,
// and far simpler to compute and reason about.
export function curveTextPath(curve: number, width: number, height: number): string {
  const clamped = clamp(curve, -100, 100);
  const baselineY = height / 2;
  const maxBulge = height * 1.5;
  const bulge = (Math.abs(clamped) / 100) * maxBulge;
  // SVG y grows downward, so a smaller y is visually "up".
  const controlY = clamped >= 0 ? baselineY - bulge : baselineY + bulge;
  return `M 0,${baselineY} Q ${width / 2},${controlY} ${width},${baselineY}`;
}
