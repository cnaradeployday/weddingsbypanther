import sharp from "sharp";
import potrace from "potrace";
import { keyOutWhiteBackground } from "./backgroundKey";

export type VectorizedLogo = { ds: string[]; width: number; height: number };

// Traces an uploaded logo into a true vector silhouette (one flat-fill
// path) — needed so a single-color-ink technique's print-ready outline file
// can include the logo as cuttable/etchable curves instead of the raster
// the customer uploaded, which most print/laser shops can't work from
// directly. Works best on simple, high-contrast artwork (exactly what a
// single flat ink color implies); complex/photographic uploads may trace as
// one coarse blob — an inherent limit of bitmap tracing, not a bug.
export async function vectorizeLogo(imageBuffer: Buffer): Promise<VectorizedLogo> {
  const TRACE_SIZE = 512;
  // Many real-world logo uploads (a JPG, or a PNG exported "flattened" by
  // a design tool) have no real alpha transparency of their own — the
  // whole canvas, background included, is opaque. Key a flat white
  // background out into transparency first so the flatten below only
  // re-fills genuine background, not artwork that happens to sit on white.
  const { data, info } = await sharp(imageBuffer)
    .resize(TRACE_SIZE, TRACE_SIZE, { fit: "inside", withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  keyOutWhiteBackground(data);

  // Flatten onto white — potrace works from luminance, and a
  // transparent-background PNG's unpremultiplied edges would otherwise trace
  // noisy artifacts around the shape's border.
  const flattened = await sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
    .flatten({ background: "#ffffff" })
    .png()
    .toBuffer();
  const { width, height } = await sharp(flattened).metadata();

  const svg = await new Promise<string>((resolve, reject) => {
    potrace.trace(
      flattened,
      { threshold: 180, turdSize: 4, optTolerance: 0.3, color: "#000000", background: "transparent" },
      (err, result) => {
        if (err) reject(err);
        else resolve(result);
      }
    );
  });

  const ds = Array.from(svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)).map((m) => m[1]);
  return { ds, width: width ?? TRACE_SIZE, height: height ?? TRACE_SIZE };
}
