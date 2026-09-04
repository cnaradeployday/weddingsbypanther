// Removes a flat white background from an uploaded logo that has no real
// alpha transparency of its own (a JPG, or a PNG exported "flattened" with
// an opaque white canvas) — the common case for a logo pulled straight from
// a brand-guidelines doc. Without this, silhouetting (recolorLogoToSolid)
// and curve-tracing (vectorizeLogo) have no transparency to key off and
// treat the *entire* rectangle as opaque artwork, producing a solid block
// instead of the logo's true shape.
//
// Keys every near-white pixel to transparent, wherever it sits — including
// the counter of a letter like "A" or "R", which almost never touches the
// image's outer edge. An earlier version only flood-filled inward from the
// border to preserve intentional white *inside* the artwork, but in
// practice that left every enclosed letterform hole filled solid with the
// chosen ink color instead of cut through, which reads far worse than the
// rare case of a genuinely white interior design element getting keyed out
// too.
//
// No-ops (returns false) if the image already carries real transparency:
// that alpha is trustworthy and must not be second-guessed.
export function keyOutWhiteBackground(data: Uint8ClampedArray | Uint8Array, tolerance = 32): boolean {
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 250) return false;
  }

  let removed = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (255 - data[i] <= tolerance && 255 - data[i + 1] <= tolerance && 255 - data[i + 2] <= tolerance) {
      data[i + 3] = 0;
      removed++;
    }
  }
  return removed > 0;
}
