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

// EDIT-11's "Background only" mode: keys out only the near-white region
// connected to the image's outer edge (a 4-connected flood fill from every
// border pixel), leaving white fully enclosed *inside* the artwork alone —
// e.g. the counter of a letter like "A" or "O" stays filled instead of
// being cut through. The unconditional keyOutWhiteBackground above is
// "All white" (also keys interior holes) — kept as-is since it's already
// the existing, working default for most logos. No-ops (returns false) on
// an image that already carries real transparency, same guard as above.
export function keyOutWhiteBackgroundConnectedToEdge(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  tolerance = 32
): boolean {
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 250) return false;
  }

  const isNearWhite = (px: number) => {
    const i = px * 4;
    return 255 - data[i] <= tolerance && 255 - data[i + 1] <= tolerance && 255 - data[i + 2] <= tolerance;
  };

  const visited = new Uint8Array(width * height);
  const queue: number[] = [];
  const pushIfBorderWhite = (x: number, y: number) => {
    const px = y * width + x;
    if (!visited[px] && isNearWhite(px)) {
      visited[px] = 1;
      queue.push(px);
    }
  };
  for (let x = 0; x < width; x++) {
    pushIfBorderWhite(x, 0);
    pushIfBorderWhite(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    pushIfBorderWhite(0, y);
    pushIfBorderWhite(width - 1, y);
  }

  let head = 0;
  let removed = 0;
  while (head < queue.length) {
    const px = queue[head++];
    data[px * 4 + 3] = 0;
    removed++;
    const x = px % width;
    const y = (px - x) / width;
    const neighbors: [number, number][] = [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ];
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const npx = ny * width + nx;
      if (!visited[npx] && isNearWhite(npx)) {
        visited[npx] = 1;
        queue.push(npx);
      }
    }
  }
  return removed > 0;
}
