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

// Was 512 — "en el render se ve bien, y cuando lo genera en svg sale mal."
// The raster composite just displays the source pixels (blur and all) at a
// forgiving on-screen size; a vector trace has zero tolerance for
// ambiguity; it has to commit to a hard edge from every soft/aliased
// pixel, so thin strokes (a script font's connecting flourishes, a small
// subtitle's fine serifs) need real working resolution to come out as
// recognizable letterforms instead of fused blobs. Doubling this gives
// potrace meaningfully more detail to work from for any upload that has
// it; `withoutEnlargement` below means a genuinely low-res source (as
// LogoToolPanel's own low-res warning would flag) is unaffected either way
// — this can't manufacture detail that was never captured.
const TRACE_SIZE = 1024;

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
    // Was `< 200` — treated any pixel short of near-fully-opaque as "not
    // real artwork," same as background. That silently dropped any
    // deliberately semi-transparent design element (e.g. a tagline set to
    // ~60% opacity for a softer look) from dominant-color detection
    // entirely — it never got its own bucket, so it had no color to be
    // assigned to later ("no caló las letras de abajo"). PNG alpha is
    // straight, not premultiplied, so a semi-transparent pixel's r/g/b
    // already *is* its true ink color regardless of alpha — only a fully
    // keyed-out (alpha === 0) pixel is actually background.
    if (data[i + 3] === 0) continue;
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

// Builds one binary mask per dominant color bucket (as PNGs potrace can
// trace) — black where a pixel belongs to that bucket, white everywhere
// else. Every opaque pixel is assigned to its single NEAREST bucket by
// color distance, rather than tested against one bucket's own tolerance in
// isolation: a per-bucket tolerance test leaves anti-aliased edge pixels
// (which blend partway between a stroke's color and the background) too
// far from *either* color to match, excluding them from every mask — for
// an already-thin stroke (a script font's connecting flourish, a small
// subtitle's serif) that 1-2px antialiased border is a large fraction of
// its total width, so this was eroding thin strokes until they
// disconnected or vanished entirely ("en svg sale mal": "Te hace brillar"
// was visibly missing characters, not just rough). Nearest-bucket
// assignment guarantees full coverage instead — no pixel falls into a gap
// between tolerances.
function buildColorMasks(
  data: Uint8Array | Buffer,
  channels: number,
  width: number,
  height: number,
  buckets: { r: number; g: number; b: number }[]
): Promise<Buffer>[] {
  const masks = buckets.map(() => Buffer.alloc(width * height, 255));
  for (let i = 0, p = 0; i < data.length; i += channels, p++) {
    // Same straight-alpha reasoning as dominantColors above: only a fully
    // keyed-out pixel (alpha === 0) is really background. The old `< 200`
    // cutoff didn't just miss semi-transparent content wholesale — for a
    // thin script-font stroke, most of its pixels never reach full
    // opacity in the first place (there's barely a "core," it's mostly
    // antialiased edge), so the cutoff left only a sparse, disconnected
    // scatter of fully-opaque pixels to trace, which potrace rendered as
    // a jagged, hand-drawn scribble instead of a solid stroke
    // ("el rojo no lo hizo solido").
    const alpha = data[i + 3];
    if (alpha === 0) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let bi = 0; bi < buckets.length; bi++) {
      const bucket = buckets[bi];
      const dr = r - bucket.r;
      const dg = g - bucket.g;
      const db = b - bucket.b;
      const dist = dr * dr + dg * dg + db * db;
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = bi;
      }
    }
    // Graded by this pixel's own opacity instead of a hard 0 — a fully
    // opaque pixel reads as solid foreground (0), a faint antialiased one
    // reads as nearly background (near 255), and everything in between
    // gets a real gray value. potrace's own threshold/curve-fit then
    // smooths that gradient into one clean, solid boundary the way it
    // already does for the flat `ds` silhouette, instead of us forcing a
    // per-pixel binary decision that amplified alpha noise into a
    // speckled, sketchy edge.
    masks[bestIdx][p] = 255 - alpha;
  }
  return masks.map((mask) => sharp(mask, { raw: { width, height, channels: 1 } }).png().toBuffer());
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
  // turdSize was 4 (px² below which potrace discards a shape as a
  // "speckle") and optTolerance 0.3 — both tuned for clean flat-color
  // logos, but too aggressive for fine text: a thin stroke or a small
  // subtitle's serifs can easily measure under 4px² even at this higher
  // TRACE_SIZE, and were being discarded outright (not just simplified —
  // the "Te hace brillar" subtitle was visibly missing characters, not
  // just rough ones). potrace's own documented defaults (turdSize 2,
  // optTolerance 0.2) preserve that fine detail instead of trading it away
  // for a simpler/smaller path.
  const ds = await traceSvgPaths(flattened, {
    threshold: 180,
    turdSize: 2,
    optTolerance: 0.2,
    color: "#000000",
    background: "transparent",
  });

  const buckets = dominantColors(data, channels, 6);
  const maskPngs = await Promise.all(buildColorMasks(data, channels, width, height, buckets));
  const layers: VectorizedLogoLayer[] = [];
  for (let i = 0; i < buckets.length; i++) {
    const color = rgbToHex(buckets[i].r, buckets[i].g, buckets[i].b);
    const layerDs = await traceSvgPaths(maskPngs[i], {
      // Was 128 — now that mask values are graded by alpha instead of hard
      // 0/255, this is the opacity cutoff for "counts as solid ink": 180
      // matches the flat `ds` silhouette's own threshold, so a deliberately
      // semi-transparent element (down to ~30% opacity) still traces solid
      // rather than fading out below a stricter 50% cutoff.
      threshold: 180,
      turdSize: 2,
      optTolerance: 0.2,
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
