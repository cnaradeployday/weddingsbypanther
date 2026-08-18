import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

// Deterministic (non-AI) compositing of a customer's personalization onto
// the real product photo. Shared by the AI-render route (which layers a
// Gemini logo restyle + wedding-context shot on top) and the plain snapshot
// route (which just needs "what did the customer configure", fast and free,
// for every add-to-cart — not only when they used the AI preview).

export type Corner = { x: number; y: number };
export type PrintZone = { corners_pct: Corner[]; width_mm?: number | null; height_mm?: number | null };
export type ImagePayload = { data: string; mimeType: string };

// Matches the aspect-[4/5] + object-cover box used everywhere the product
// photo is shown (the admin print-area tool and the storefront product
// page), so pixel math derived from corners_pct lines up with what was
// actually configured.
const STOREFRONT_ASPECT = 4 / 5;

export async function cropToStorefrontAspect(base: ImagePayload): Promise<ImagePayload> {
  try {
    const buffer = Buffer.from(base.data, "base64");
    const image = sharp(buffer);
    const { width, height } = await image.metadata();
    if (!width || !height) return base;

    let cropW = width;
    let cropH = height;
    const currentAspect = width / height;
    if (currentAspect > STOREFRONT_ASPECT) {
      cropW = Math.round(height * STOREFRONT_ASPECT);
    } else if (currentAspect < STOREFRONT_ASPECT) {
      cropH = Math.round(width / STOREFRONT_ASPECT);
    }
    const left = Math.max(0, Math.round((width - cropW) / 2));
    const top = Math.max(0, Math.round((height - cropH) / 2));

    const cropped = await image
      .extract({ left, top, width: cropW, height: cropH })
      .png()
      .toBuffer();

    return { data: cropped.toString("base64"), mimeType: "image/png" };
  } catch {
    return base;
  }
}

// Prompt instructions alone weren't reliably enough to keep small artwork
// details (a logo's brand-color accent dot, an icon fragment) from leaking
// through unconverted on color-incapable techniques like laser engraving.
// Stripping color from the source pixels here removes the possibility
// entirely — there is no color left for the model (or the plain snapshot)
// to (mis)reproduce.
export async function toGrayscale(image: ImagePayload): Promise<ImagePayload> {
  try {
    const buffer = Buffer.from(image.data, "base64");
    const gray = await sharp(buffer).grayscale().png().toBuffer();
    return { data: gray.toString("base64"), mimeType: "image/png" };
  } catch {
    return image;
  }
}

export async function loadImageAsBase64(url: string): Promise<ImagePayload | null> {
  try {
    if (url.startsWith("/")) {
      const filePath = path.join(process.cwd(), "public", url);
      const bytes = await readFile(filePath);
      const ext = path.extname(url).toLowerCase();
      const mimeType = ext === ".png" ? "image/png" : "image/jpeg";
      return { data: bytes.toString("base64"), mimeType };
    }
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const mimeType = res.headers.get("content-type") ?? "image/jpeg";
    return { data: Buffer.from(buf).toString("base64"), mimeType };
  } catch {
    return null;
  }
}

function escapeXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function boundingBoxPx(corners: Corner[], width: number, height: number) {
  const xs = corners.map((c) => (c.x / 100) * width);
  const ys = corners.map((c) => (c.y / 100) * height);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  return { left, top, width: Math.max(...xs) - left, height: Math.max(...ys) - top };
}

export function clampInt(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(v)));
}

// The print zone is a freeform quad (corners can be dragged independently
// for angled/perspective product shots), stored TL/TR/BR/BL. Its visual
// tilt is approximated by the angle of its top edge, in real photo pixel
// space (not raw percentages, which would be skewed by a non-square photo).
export function zoneRotationDeg(corners: Corner[], width: number, height: number): number {
  if (corners.length !== 4) return 0;
  const tl = { x: (corners[0].x / 100) * width, y: (corners[0].y / 100) * height };
  const tr = { x: (corners[1].x / 100) * width, y: (corners[1].y / 100) * height };
  return (Math.atan2(tr.y - tl.y, tr.x - tl.x) * 180) / Math.PI;
}

// Builds the personalization as its own flat image (white background, logo
// + text laid out exactly where the customer dragged each element) rather
// than asking an image-editing model to place things on the real product
// photo. Placement here is plain arithmetic, so it can't drift the way an
// AI edit of the whole photo could.
export type ElemKey = "logo" | "monogram" | "names" | "date";

export async function buildArtworkImage({
  canvasW,
  canvasH,
  logoImage,
  logoBoxSize,
  positions,
  names,
  date,
  monogram,
  inkColor,
  fontScale = {},
  rotations = {},
}: {
  canvasW: number;
  canvasH: number;
  logoImage: ImagePayload | null;
  logoBoxSize?: number;
  positions: Record<string, { x: number; y: number }>;
  names: string;
  date: string;
  monogram: string;
  inkColor: string;
  fontScale?: Partial<Record<Exclude<ElemKey, "logo">, number>>;
  rotations?: Partial<Record<ElemKey, number>>;
}): Promise<Buffer> {
  const pos = (key: string, fallback: Corner) => positions[key] ?? fallback;
  // Rotate each element around its own anchor point so it sits flush with
  // the (possibly angled) print area, the same way it looks embossed/
  // engraved into a tilted surface rather than pasted on upright. Each
  // element (logo/monogram/names/date) carries its own independent
  // rotation and (for text) font-size multiplier, matching the on-canvas
  // resize/rotate handles in the product builder.
  const rotateAttr = (cx: number, cy: number, key: ElemKey) => {
    const deg = rotations[key] ?? 0;
    return deg ? ` transform="rotate(${deg} ${cx} ${cy})"` : "";
  };

  let logoElement = "";
  if (logoImage) {
    const boxSize = Math.max(1, Math.round(logoBoxSize ?? canvasW * 0.45));
    const fitted = await sharp(Buffer.from(logoImage.data, "base64"))
      .resize(boxSize, boxSize, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png()
      .toBuffer();
    const p = pos("logo", { x: 50, y: 35 });
    const cx = (p.x / 100) * canvasW;
    const cy = (p.y / 100) * canvasH;
    const x = Math.round(cx - boxSize / 2);
    const y = Math.round(cy - boxSize / 2);
    logoElement = `<image x="${x}" y="${y}" width="${boxSize}" height="${boxSize}" href="data:image/png;base64,${fitted.toString(
      "base64"
    )}"${rotateAttr(cx, cy, "logo")} />`;
  }

  const textElements: string[] = [];
  if (monogram.trim()) {
    const p = pos("monogram", { x: 50, y: 15 });
    const cx = (p.x / 100) * canvasW;
    const cy = (p.y / 100) * canvasH;
    const fontSize = canvasH * 0.14 * (fontScale.monogram ?? 1);
    textElements.push(
      `<text x="${cx}" y="${cy}" font-size="${fontSize}" font-family="Georgia, 'Times New Roman', serif" fill="${inkColor}" text-anchor="middle" dominant-baseline="central"${rotateAttr(cx, cy, "monogram")}>${escapeXml(monogram)}</text>`
    );
  }
  if (names.trim()) {
    const p = pos("names", { x: 50, y: 65 });
    const cx = (p.x / 100) * canvasW;
    const cy = (p.y / 100) * canvasH;
    const fontSize = canvasH * 0.11 * (fontScale.names ?? 1);
    textElements.push(
      `<text x="${cx}" y="${cy}" font-size="${fontSize}" font-family="Georgia, 'Times New Roman', serif" fill="${inkColor}" text-anchor="middle" dominant-baseline="central"${rotateAttr(cx, cy, "names")}>${escapeXml(names.trim())}</text>`
    );
  }
  if (date.trim()) {
    const p = pos("date", { x: 50, y: 82 });
    const cx = (p.x / 100) * canvasW;
    const cy = (p.y / 100) * canvasH;
    const fontSize = canvasH * 0.05 * (fontScale.date ?? 1);
    textElements.push(
      `<text x="${cx}" y="${cy}" font-size="${fontSize}" font-family="Georgia, 'Times New Roman', serif" letter-spacing="1" fill="${inkColor}" text-anchor="middle" dominant-baseline="central"${rotateAttr(cx, cy, "date")}>${escapeXml(date.trim())}</text>`
    );
  }

  const svg = `<svg width="${canvasW}" height="${canvasH}" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="${canvasW}" height="${canvasH}" fill="white" />
    ${logoElement}
    ${textElements.join("\n")}
  </svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

// Multiply-blends the artwork onto the real product photo at the exact
// print-area location — the same trick mockup generators use so the
// product's own lighting/texture shows through the "ink", and white stays
// invisible. This is deterministic pixel math, not a model guessing.
//
// The artwork buffer must already be rendered at (targetW x targetH) — do
// not resize it here. Rendering the SVG text/logo directly at final size
// (rather than rendering big and downscaling with Lanczos) avoids the
// resize-kernel ringing/haloing that leaves a faint white "shadow" around
// engraved text edges.
export async function compositePersonalization(
  base: ImagePayload,
  artwork: Buffer,
  box: { left: number; top: number; width: number; height: number },
  targetW: number,
  targetH: number
): Promise<ImagePayload> {
  const buffer = Buffer.from(base.data, "base64");
  const image = sharp(buffer);
  const meta = await image.metadata();
  const width = meta.width ?? Math.round(box.left + box.width);
  const height = meta.height ?? Math.round(box.top + box.height);

  const cx = box.left + box.width / 2;
  const cy = box.top + box.height / 2;
  const left = clampInt(cx - targetW / 2, 0, Math.max(0, width - targetW));
  const top = clampInt(cy - targetH / 2, 0, Math.max(0, height - targetH));

  const composited = await image
    .composite([{ input: artwork, left, top, blend: "multiply" }])
    .png()
    .toBuffer();

  return { data: composited.toString("base64"), mimeType: "image/png" };
}

// Full deterministic pipeline: load the reference photo, crop it to the
// storefront aspect, lay out the logo/text artwork exactly where the
// customer positioned it, and composite it on — no AI calls at all. Used
// both as the base step before the AI-render route's Gemini passes, and as
// the whole pipeline for the always-on cart snapshot.
// Default logo footprint: 45% of the print area's *smaller* physical
// dimension (width_mm/height_mm, entered when the product was set up),
// converted to pixels — not a flat fraction of the canvas. That way a logo
// on a small zone doesn't render oversized relative to it, and one on a
// large zone doesn't render tiny. Falls back to a flat 45% of canvas width
// when the zone has no mm dimensions on file.
function defaultLogoBoxSize(canvasW: number, canvasH: number, zone: PrintZone | undefined): number {
  if (zone?.width_mm && zone?.height_mm) {
    const pxPerMm = Math.min(canvasW / zone.width_mm, canvasH / zone.height_mm);
    const smallerMm = Math.min(zone.width_mm, zone.height_mm);
    return pxPerMm * smallerMm * 0.45;
  }
  return canvasW * 0.45;
}

export async function composeProductPersonalization({
  referenceImageUrl,
  zone,
  logoImage,
  positions,
  names,
  date,
  monogram,
  inkColor,
  elemScale = {},
  elemRotationOffsetDeg = {},
}: {
  referenceImageUrl: string;
  zone: PrintZone | undefined;
  logoImage: ImagePayload | null;
  positions: Record<string, { x: number; y: number }>;
  names: string;
  date: string;
  monogram: string;
  inkColor: string;
  elemScale?: Partial<Record<ElemKey, number>>;
  elemRotationOffsetDeg?: Partial<Record<ElemKey, number>>;
}): Promise<ImagePayload | null> {
  const baseImage = await loadImageAsBase64(referenceImageUrl);
  if (!baseImage) return null;
  const croppedBase = await cropToStorefrontAspect(baseImage);

  const photoMeta = await sharp(Buffer.from(croppedBase.data, "base64")).metadata();
  const photoW = photoMeta.width ?? 1000;
  const photoH = photoMeta.height ?? 1250;

  const box =
    zone && zone.corners_pct.length === 4
      ? boundingBoxPx(zone.corners_pct, photoW, photoH)
      : { left: photoW * 0.25, top: photoH * 0.3, width: photoW * 0.5, height: photoH * 0.3 };

  const canvasW = Math.max(1, Math.round(box.width));
  const canvasH = Math.max(1, Math.round(box.height));
  const baseRotationDeg = zone && zone.corners_pct.length === 4 ? zoneRotationDeg(zone.corners_pct, photoW, photoH) : 0;
  const rotations: Partial<Record<ElemKey, number>> = {
    logo: baseRotationDeg + (elemRotationOffsetDeg.logo ?? 0),
    monogram: baseRotationDeg + (elemRotationOffsetDeg.monogram ?? 0),
    names: baseRotationDeg + (elemRotationOffsetDeg.names ?? 0),
    date: baseRotationDeg + (elemRotationOffsetDeg.date ?? 0),
  };
  const logoBoxSize = defaultLogoBoxSize(canvasW, canvasH, zone) * (elemScale.logo ?? 1);

  const artworkBuffer = await buildArtworkImage({
    canvasW,
    canvasH,
    logoImage,
    logoBoxSize,
    positions,
    names,
    date,
    monogram,
    inkColor,
    fontScale: { monogram: elemScale.monogram ?? 1, names: elemScale.names ?? 1, date: elemScale.date ?? 1 },
    rotations,
  });

  return compositePersonalization(croppedBase, artworkBuffer, box, canvasW, canvasH);
}
