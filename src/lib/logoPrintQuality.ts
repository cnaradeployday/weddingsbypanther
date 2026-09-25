// Flags a logo whose pixel density is too low to hold up on a UV flatbed
// print at the size it's actually being placed — the common real-world
// failure mode being a logo pulled off a website (often 72dpi-equivalent at
// a few hundred pixels wide) blown up to cover a multi-inch print area.
// 150dpi is the accepted floor for a flatbed UV print viewed at normal
// arm's-length distance (fine detail, small text, or an up-close viewing
// distance would want the 300dpi+ commonly used for offset/litho, but that's
// stricter than this medium needs); below it, dithering and edge softness
// become visible to the naked eye.
export const MIN_PRINT_DPI = 150;

export function estimatePrintDpi(pixelWidth: number, footprintWidthMm: number): number | null {
  if (!pixelWidth || !footprintWidthMm || footprintWidthMm <= 0) return null;
  const footprintInches = footprintWidthMm / 25.4;
  return pixelWidth / footprintInches;
}

// The logo's default on-print footprint (45% of the print area's smaller
// physical dimension, scaled by however much the customer has resized it) —
// shared between the live editor and 03-purchase-flow.md's Review step
// (FLOW-06), which needs the same low-res warning without access to the
// editor's own DOM measurements. Mirrors the server compositor's
// `defaultLogoBoxSize` (personalizationComposite.ts), expressed in real mm
// instead of render pixels since neither caller has a canvas to measure.
export function estimateLogoFootprintMm(
  zone: { width_mm: number | null; height_mm: number | null } | null | undefined,
  elemScaleLogo: number
): number | null {
  if (!zone?.width_mm || !zone?.height_mm) return null;
  const smallerMm = Math.min(zone.width_mm, zone.height_mm);
  return smallerMm * 0.45 * elemScaleLogo;
}
