import sharp from "sharp";
import potrace from "potrace";
import { keyOutWhiteBackground } from "./backgroundKey";

export type VectorizedLogoLayer = { ds: string[]; color: string };

export type VectorizedLogo = {
  // A single flat-fill silhouette (ignores the logo's real colors entirely)
  // — what a single-color-ink technique's print-ready outline needs, since
  // the whole logo prints in one uniform customer-chosen ink color there.
  ds: string[];
  width: number;
  height: number;
  // One traced layer per dominant color actually in the logo, each filled
  // with its own real color — what a full-color technique's print-ready
  // outline needs instead of `ds` forced into a single ink color. Ordered
  // largest-area first so smaller detail colors draw on top of it, not
  // underneath. Always at least one layer when the logo has any opaque
  // pixels at all (a near-solid-color logo just gets one layer, in its own
  // real color, rather than being left out).
  layers: VectorizedLogoLayer[];
};

const TRACE_SIZE = 512;

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

// Buckets the image's opaque pixels into up to `maxColors` dominant colors
// — the same quantize-by-rounded-channel approach as logoColors.ts's
// client-side palette detection (used for the "colors detected" chips),
// ported here since this runs server-side at upload time, with no DOM/
// canvas available. Small/noisy buckets (anti-aliased edge slivers) under
// `minShare` of the opaque pixel count are dropped rather than spending a
// whole extra potrace pass tracing a handful of stray pixels.
function dominantColors(
  data: Uint8Array | Buffer,
  channels: number,
  maxColors: number,
  minShare = 0.02
): { r: number; g: number; b: number; count: number }[] {
  const STEP = 24;
  const buckets = new Map<string, { r: number; g: number; b: number; count: number }>();
  let opaqueCount = 0;
  for (let i = 0; i < data.length; i += channels) {
    if (data[i + 3] < 200) continue;
    opaqueCount++;
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
  }
  if (opaqueCount === 0) return [];
  return [...buckets.values()]
    .filter((b) => b.count / opaqueCount >= minShare)
    .sort((a, b) => b.count - a.count)
    .slice(0, maxColors)
    // Buckets accumulate r/g/b as running sums while scanning (to keep the
    // per-pixel loop above allocation-free) — average them down to an
    // actual per-channel color here, once, for the handful of buckets that
    // survive. Returning the raw sums made every downstream tolerance
    // comparison (against real 0-255 pixel values) always fail, since a
    // bucket's "r" could be in the tens of thousands.
    .map((b) => ({ r: Math.round(b.r / b.count), g: Math.round(b.g / b.count), b: Math.round(b.b / b.count), count: b.count }));
}

function traceSvgPaths(imagePngOrBuffer: Buffer, options: potrace.PotraceOptions): Promise<string[]> {
  return new Promise((resolve, reject) => {
    potrace.trace(imagePngOrBuffer, options, (err, svg) => {
      if (err) reject(err);
      else resolve(Array.from(svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)).map((m) => m[1]));
    });
  });
}

// Builds a binary mask (as a PNG potrace can trace) isolating just the
// pixels close to one dominant color bucket — black where that color is,
// white everywhere else (potrace's own luminance threshold then traces the
// black region as one shape).
function buildColorMaskPng(
  data: Uint8Array | Buffer,
  channels: number,
  width: number,
  height: number,
  bucket: { r: number; g: number; b: number },
  tolerance = 24
): Promise<Buffer> {
  const mask = Buffer.alloc(width * height, 255);
  for (let i = 0, p = 0; i < data.length; i += channels, p++) {
    const opaque = data[i + 3] >= 200;
    const close =
      opaque &&
      Math.abs(data[i] - bucket.r) <= tolerance &&
      Math.abs(data[i + 1] - bucket.g) <= tolerance &&
      Math.abs(data[i + 2] - bucket.b) <= tolerance;
    mask[p] = close ? 0 : 255;
  }
  return sharp(mask, { raw: { width, height, channels: 1 } }).png().toBuffer();
}

// Traces an uploaded logo into true vector curves — both as a single flat
// silhouette (`ds`, for single-color-ink techniques) and as one real-color
// layer per dominant color in the artwork (`layers`, for full-color
// techniques, which previously had no vector export at all worth using:
// the silhouette alone collapses every color to one flat ink, which is
// wrong for a technique that actually prints in full color). Works best on
// simple, high-contrast artwork; complex/photographic uploads may trace as
// one or two coarse blobs per layer — an inherent limit of bitmap tracing,
// not a bug.
export async function vectorizeLogo(imageBuffer: Buffer): Promise<VectorizedLogo> {
  // Many real-world logo uploads (a JPG, or a PNG exported "flattened" by
  // a design tool) have no real alpha transparency of their own — the
  // whole canvas, background included, is opaque. Key the background out
  // into transparency first so the flatten below (and the per-color masks)
  // only re-fill/measure genuine artwork, not background.
  const { data, info } = await sharp(imageBuffer)
    .resize(TRACE_SIZE, TRACE_SIZE, { fit: "inside", withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  keyOutWhiteBackground(data, info.width, info.height);
  const { width, height, channels } = info;

  // Flatten onto white — potrace works from luminance, and a
  // transparent-background PNG's unpremultiplied edges would otherwise trace
  // noisy artifacts around the shape's border.
  const flattened = await sharp(data, { raw: { width, height, channels } })
    .flatten({ background: "#ffffff" })
    .png()
    .toBuffer();
  const ds = await traceSvgPaths(flattened, {
    threshold: 180,
    turdSize: 4,
    optTolerance: 0.3,
    color: "#000000",
    background: "transparent",
  });

  const buckets = dominantColors(data, channels, 6);
  const layers: VectorizedLogoLayer[] = [];
  for (const bucket of buckets) {
    const color = rgbToHex(bucket.r, bucket.g, bucket.b);
    const maskPng = await buildColorMaskPng(data, channels, width, height, bucket);
    const layerDs = await traceSvgPaths(maskPng, {
      threshold: 128,
      turdSize: 4,
      optTolerance: 0.3,
      color,
      background: "transparent",
    });
    if (layerDs.length) layers.push({ ds: layerDs, color });
  }
  // A logo with no bucket surviving the noise filter (vanishingly rare —
  // only an almost-entirely-transparent upload) still gets the flat
  // silhouette as its one color layer, so `layers` is never empty when
  // `ds` isn't.
  if (!layers.length && ds.length) layers.push({ ds, color: "#000000" });

  return { ds, width: width ?? TRACE_SIZE, height: height ?? TRACE_SIZE, layers };
}
