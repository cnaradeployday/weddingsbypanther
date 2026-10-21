// Removes an uploaded logo's flat background when it has no real alpha
// transparency of its own (a JPG, or a PNG exported "flattened" with an
// opaque canvas) — without this, silhouetting (recolorLogoToSolid) and
// curve-tracing (vectorizeLogo) have no transparency to key off and treat
// the *entire* rectangle as opaque artwork, producing a solid block instead
// of the logo's true shape.
//
// Was hardcoded to assume the background is white — plenty of real uploads
// have a black (or other flat-color) canvas instead, which this silently
// left untouched ("necesito que detecte si el fondo es blanco o negro... no
// solo blanco"). Detects the actual background color instead of assuming
// one: a logo's artwork essentially never fills the frame edge-to-edge, so
// sampling the image's own outer border and taking its most common color is
// a reliable stand-in for "whatever the background actually is," white,
// black, or anything else.
//
// Still only handles a flat, roughly-uniform background — a photographic
// one needs real subject/background segmentation, which is a different,
// much harder problem (see LogoToolPanel's note on why that isn't available
// here).
export function detectBackgroundColor(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number
): { r: number; g: number; b: number } | null {
  const STEP = 24; // same quantization bucket size as logoColors.ts's palette detection
  const buckets = new Map<string, { r: number; g: number; b: number; count: number }>();
  const sample = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    if (data[i + 3] < 200) return; // already transparent — not part of the flat background
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const key = `${Math.round(r / STEP)}-${Math.round(g / STEP)}-${Math.round(b / STEP)}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      bucket.count++;
    } else {
      buckets.set(key, { r, g, b, count: 1 });
    }
  };
  for (let x = 0; x < width; x++) {
    sample(x, 0);
    sample(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    sample(0, y);
    sample(width - 1, y);
  }
  if (buckets.size === 0) return null;
  const top = [...buckets.values()].sort((a, b) => b.count - a.count)[0];
  return { r: Math.round(top.r / top.count), g: Math.round(top.g / top.count), b: Math.round(top.b / top.count) };
}

function isCloseToColor(data: Uint8ClampedArray | Uint8Array, i: number, color: { r: number; g: number; b: number }, tolerance: number) {
  return (
    Math.abs(data[i] - color.r) <= tolerance &&
    Math.abs(data[i + 1] - color.g) <= tolerance &&
    Math.abs(data[i + 2] - color.b) <= tolerance
  );
}

// Keys every pixel close to the detected background color to transparent,
// wherever it sits — including the counter of a letter like "A" or "R",
// which almost never touches the image's outer edge. An earlier version
// only flood-filled inward from the border to preserve intentional
// background-colored pixels *inside* the artwork, but in practice that left
// every enclosed letterform hole filled solid with the chosen ink color
// instead of cut through, which reads far worse than the rare case of a
// genuinely background-colored interior design element getting keyed out
// too.
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
  const bg = detectBackgroundColor(data, width, height);
  if (!bg) return false;

  let removed = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (isCloseToColor(data, i, bg, tolerance)) {
      data[i + 3] = 0;
      removed++;
    }
  }
  return removed > 0;
}

// EDIT-11's "Background only" mode: keys out only the detected-background-
// color region connected to the image's outer edge (a 4-connected flood
// fill from every border pixel), leaving that same color fully enclosed
// *inside* the artwork alone — e.g. the counter of a letter like "A" or "O"
// stays filled instead of being cut through. The unconditional
// keyOutWhiteBackground above is "All [background color]" (also keys
// interior holes) — kept as-is since it's already the existing, working
// default for most logos. No-ops (returns false) on an image that already
// carries real transparency, same guard as above.
export function keyOutWhiteBackgroundConnectedToEdge(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  tolerance = 32
): boolean {
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 250) return false;
  }
  const bg = detectBackgroundColor(data, width, height);
  if (!bg) return false;

  const matchesBg = (px: number) => isCloseToColor(data, px * 4, bg, tolerance);

  const visited = new Uint8Array(width * height);
  const queue: number[] = [];
  const pushIfBorderMatch = (x: number, y: number) => {
    const px = y * width + x;
    if (!visited[px] && matchesBg(px)) {
      visited[px] = 1;
      queue.push(px);
    }
  };
  for (let x = 0; x < width; x++) {
    pushIfBorderMatch(x, 0);
    pushIfBorderMatch(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    pushIfBorderMatch(0, y);
    pushIfBorderMatch(width - 1, y);
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
      if (!visited[npx] && matchesBg(npx)) {
        visited[npx] = 1;
        queue.push(npx);
      }
    }
  }
  return removed > 0;
}
