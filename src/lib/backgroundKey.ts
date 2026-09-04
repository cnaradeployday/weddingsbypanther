// Removes a flat white background from an uploaded logo that has no real
// alpha transparency of its own (a JPG, or a PNG exported "flattened" with
// an opaque white canvas) — the common case for a logo pulled straight from
// a brand-guidelines doc. Without this, silhouetting (recolorLogoToSolid)
// and curve-tracing (vectorizeLogo) have no transparency to key off and
// treat the *entire* rectangle as opaque artwork, producing a solid block
// instead of the logo's true shape.
//
// Flood-fills inward from the image's four edges, turning near-white pixels
// connected to the border transparent. Starting from the border (rather than
// thresholding every pixel) means genuine white *inside* the artwork — the
// counter of a letter "O", a white highlight — survives untouched as long as
// it doesn't touch the edge.
//
// No-ops (returns false) if the image already carries real transparency:
// that alpha is trustworthy and must not be second-guessed.
export function keyOutWhiteBackground(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  tolerance = 32
): boolean {
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 250) return false;
  }

  const isNearWhite = (idx: number) =>
    255 - data[idx] <= tolerance && 255 - data[idx + 1] <= tolerance && 255 - data[idx + 2] <= tolerance;

  const visited = new Uint8Array(width * height);
  const stack: number[] = [];
  const pushIfSeed = (x: number, y: number) => {
    const p = y * width + x;
    if (visited[p]) return;
    visited[p] = 1;
    if (isNearWhite(p * 4)) stack.push(p);
  };

  for (let x = 0; x < width; x++) {
    pushIfSeed(x, 0);
    pushIfSeed(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    pushIfSeed(0, y);
    pushIfSeed(width - 1, y);
  }

  let removed = 0;
  while (stack.length) {
    const p = stack.pop()!;
    data[p * 4 + 3] = 0;
    removed++;
    const x = p % width;
    const y = (p / width) | 0;
    if (x > 0) pushIfSeed(x - 1, y);
    if (x < width - 1) pushIfSeed(x + 1, y);
    if (y > 0) pushIfSeed(x, y - 1);
    if (y < height - 1) pushIfSeed(x, y + 1);
  }
  return removed > 0;
}
