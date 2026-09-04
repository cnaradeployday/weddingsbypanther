// Approximate PANTONE Solid Coated matching — NOT an official Pantone
// conversion (no licensed Pantone library/data is integrated in this app).
// This is a small curated reference table of well-known PMS colors and
// their commonly published hex approximations, used only to point a
// supplier toward the closest standard ink so far apart custom mixes aren't
// needed. Always surface this as "closest match (approximate)" to the
// customer/admin, never as an exact/certified conversion.
const PANTONE_REFERENCE: { code: string; hex: string }[] = [
  { code: "PMS Black C", hex: "#2D2926" },
  { code: "PMS Cool Gray 1 C", hex: "#D9D9D6" },
  { code: "PMS Cool Gray 5 C", hex: "#B1B3B3" },
  { code: "PMS Cool Gray 9 C", hex: "#75787B" },
  { code: "PMS Cool Gray 11 C", hex: "#53565A" },
  { code: "PMS White", hex: "#FFFFFF" },
  { code: "PMS Warm Gray 1 C", hex: "#D7D2CB" },
  { code: "PMS Warm Gray 7 C", hex: "#97948F" },
  { code: "PMS 1235 C", hex: "#FFB81C" },
  { code: "PMS Yellow C", hex: "#FEDD00" },
  { code: "PMS 116 C", hex: "#FFCD00" },
  { code: "PMS 123 C", hex: "#FFC72C" },
  { code: "PMS 137 C", hex: "#FF8F1C" },
  { code: "PMS 151 C", hex: "#FF8200" },
  { code: "PMS Orange 021 C", hex: "#FE5000" },
  { code: "PMS 165 C", hex: "#FF5000" },
  { code: "PMS 173 C", hex: "#E4572E" },
  { code: "PMS 179 C", hex: "#E03C31" },
  { code: "PMS Warm Red C", hex: "#F9423A" },
  { code: "PMS Red 032 C", hex: "#EF3340" },
  { code: "PMS 186 C", hex: "#C8102E" },
  { code: "PMS 200 C", hex: "#BA0C2F" },
  { code: "PMS 202 C", hex: "#862633" },
  { code: "PMS 209 C", hex: "#95536C" },
  { code: "PMS Rubine Red C", hex: "#CE0058" },
  { code: "PMS 213 C", hex: "#D6006D" },
  { code: "PMS 219 C", hex: "#CC0072" },
  { code: "PMS 225 C", hex: "#AA0061" },
  { code: "PMS 232 C", hex: "#93328E" },
  { code: "PMS Purple C", hex: "#8A1B61" },
  { code: "PMS 253 C", hex: "#875FA8" },
  { code: "PMS 259 C", hex: "#652D86" },
  { code: "PMS 267 C", hex: "#5F259F" },
  { code: "PMS Violet C", hex: "#440099" },
  { code: "PMS 2725 C", hex: "#5251A3" },
  { code: "PMS 2728 C", hex: "#1E3388" },
  { code: "PMS Reflex Blue C", hex: "#001489" },
  { code: "PMS 286 C", hex: "#0032A0" },
  { code: "PMS 293 C", hex: "#003DA5" },
  { code: "PMS 300 C", hex: "#005EB8" },
  { code: "PMS 3005 C", hex: "#0077C8" },
  { code: "PMS 312 C", hex: "#00A9E0" },
  { code: "PMS Process Blue C", hex: "#0085CA" },
  { code: "PMS 320 C", hex: "#00A3AD" },
  { code: "PMS 3145 C", hex: "#007A87" },
  { code: "PMS 3155 C", hex: "#00565B" },
  { code: "PMS 3272 C", hex: "#00B398" },
  { code: "PMS Green C", hex: "#00AB84" },
  { code: "PMS 340 C", hex: "#00594C" },
  { code: "PMS 348 C", hex: "#00843D" },
  { code: "PMS 355 C", hex: "#00B140" },
  { code: "PMS 361 C", hex: "#43B02A" },
  { code: "PMS 368 C", hex: "#78BE21" },
  { code: "PMS 376 C", hex: "#84BD00" },
  { code: "PMS 383 C", hex: "#A2AD00" },
  { code: "PMS 390 C", hex: "#C4D600" },
  { code: "PMS 396 C", hex: "#D9E12B" },
  { code: "PMS 109 C", hex: "#FFD100" },
  { code: "PMS 872 C", hex: "#8A6D3B" },
  { code: "PMS 873 C", hex: "#9C7A3C" },
  { code: "PMS 4625 C", hex: "#3E2A1E" },
  { code: "PMS 469 C", hex: "#7B3F00" },
  { code: "PMS 476 C", hex: "#4A3728" },
  { code: "PMS 483 C", hex: "#8B3A2B" },
  { code: "PMS 7530 C", hex: "#C4B7A6" },
  { code: "PMS 7541 C", hex: "#D3D6D8" },
  { code: "PMS 7546 C", hex: "#3F4548" },
  { code: "PMS 424 C", hex: "#63666A" },
];

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

// "Redmean" weighted RGB distance — a cheap, well-known approximation of
// perceptual color difference that's much closer to how colors actually
// look than plain Euclidean RGB distance, without needing a full Lab
// conversion.
function colorDistance(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }) {
  const rMean = (a.r + b.r) / 2;
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(
    (2 + rMean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rMean) / 256) * db * db
  );
}

export type PantoneMatch = { code: string; hex: string };

// Nearest PANTONE Solid Coated reference to `hex`, by approximate visual
// distance. Always an approximation — labeled as such everywhere it's shown.
export function nearestPantone(hex: string): PantoneMatch | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  let best: PantoneMatch | null = null;
  let bestDist = Infinity;
  for (const ref of PANTONE_REFERENCE) {
    const refRgb = hexToRgb(ref.hex);
    if (!refRgb) continue;
    const dist = colorDistance(rgb, refRgb);
    if (dist < bestDist) {
      bestDist = dist;
      best = ref;
    }
  }
  return best;
}

// "PMS 355 C", "PMS 355", "355 C", "355" and "reflex blue" should all match
// the same reference row — people type Pantone codes in whatever shorthand
// they're used to, not the exact "PMS ### C" form this table stores them in.
function normalizePantoneCode(code: string): string {
  return code
    .trim()
    .toUpperCase()
    .replace(/^PMS\s*/, "")
    .replace(/\s*C$/, "")
    .replace(/\s+/g, " ");
}

// Resolves free-form text typed into the ink-color box — a hex value
// ("#1a2b3c", "1a2b3c") or a Pantone code in any of the ways people actually
// write it — into a concrete hex color, alongside the exact matched code
// when it came from a Pantone lookup rather than a hex value. Returns null
// for input that matches neither shape, so the caller can leave the current
// color untouched rather than guess at a partial/invalid entry.
export function resolveColorInput(input: string): { hex: string; pantoneCode?: string } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const asRgb = hexToRgb(trimmed);
  if (asRgb) {
    const digits = /^#?([0-9a-f]{6})$/i.exec(trimmed)![1];
    return { hex: `#${digits.toUpperCase()}` };
  }
  const norm = normalizePantoneCode(trimmed);
  const match = PANTONE_REFERENCE.find((ref) => normalizePantoneCode(ref.code) === norm);
  return match ? { hex: match.hex, pantoneCode: match.code } : null;
}
