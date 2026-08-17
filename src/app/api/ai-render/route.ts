import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { supabase } from "@/lib/supabase";
import { techniqueInkColor } from "@/lib/printTechniqueColors";

export const runtime = "nodejs";

const FALLBACK_FINISH = "a clean printed finish";
const FALLBACK_COLOR_MODE = "Match the color treatment to a realistic printed finish.";

// Any output must be a single, edge-to-edge photograph — image-editing
// models will sometimes "helpfully" produce a moodboard/collage of several
// small mockups instead of one edited photo, which is unusable here.
const SINGLE_IMAGE_RULE =
  "Output exactly ONE photograph that fills the entire frame edge-to-edge. Never produce a collage, grid, moodboard, multiple thumbnails, side-by-side variations, empty margins/borders, or any UI chrome — just one single, full-bleed photo.";

type Corner = { x: number; y: number };
type PrintZone = { corners_pct: Corner[] };
type ImagePayload = { data: string; mimeType: string };

// Matches the aspect-[4/5] + object-cover box used everywhere the product
// photo is shown (the admin print-area tool and the storefront product
// page), so pixel math derived from corners_pct lines up with what was
// actually configured.
const STOREFRONT_ASPECT = 4 / 5;

async function cropToStorefrontAspect(base: ImagePayload): Promise<ImagePayload> {
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
// entirely — there is no color left for the model to (mis)reproduce.
async function toGrayscale(image: ImagePayload): Promise<ImagePayload> {
  try {
    const buffer = Buffer.from(image.data, "base64");
    const gray = await sharp(buffer).grayscale().png().toBuffer();
    return { data: gray.toString("base64"), mimeType: "image/png" };
  } catch {
    return image;
  }
}

async function loadImageAsBase64(url: string): Promise<ImagePayload | null> {
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

async function callGemini(
  apiKey: string,
  prompt: string,
  images: ImagePayload[]
): Promise<{ image: ImagePayload } | { error: string }> {
  const parts: Record<string, unknown>[] = [{ text: prompt }];
  for (const img of images) parts.push({ inline_data: { mime_type: img.mimeType, data: img.data } });

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts }] }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return { error: `AI render failed: ${errText.slice(0, 300)}` };
    }

    const json = await geminiRes.json();
    const resultParts = json?.candidates?.[0]?.content?.parts ?? [];
    const imagePart = resultParts.find((p: { inlineData?: { data?: string } }) => p.inlineData?.data);

    if (!imagePart?.inlineData?.data) {
      return { error: "The model didn't return an image." };
    }

    return {
      image: { data: imagePart.inlineData.data, mimeType: imagePart.inlineData.mimeType ?? "image/png" },
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "AI render failed." };
  }
}

function escapeXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function boundingBoxPx(corners: Corner[], width: number, height: number) {
  const xs = corners.map((c) => (c.x / 100) * width);
  const ys = corners.map((c) => (c.y / 100) * height);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  return { left, top, width: Math.max(...xs) - left, height: Math.max(...ys) - top };
}

function clampInt(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(v)));
}

// Builds the personalization as its own flat image (white background, logo
// + text laid out exactly where the customer dragged each element) rather
// than asking an image-editing model to place things on the real product
// photo. Placement here is plain arithmetic, so it can't drift the way an
// AI edit of the whole photo could.
async function buildArtworkImage({
  canvasW,
  canvasH,
  logoImage,
  positions,
  names,
  date,
  monogram,
  inkColor,
}: {
  canvasW: number;
  canvasH: number;
  logoImage: ImagePayload | null;
  positions: Record<string, { x: number; y: number }>;
  names: string;
  date: string;
  monogram: string;
  inkColor: string;
}): Promise<Buffer> {
  const pos = (key: string, fallback: Corner) => positions[key] ?? fallback;

  let logoElement = "";
  if (logoImage) {
    const boxSize = Math.round(canvasW * 0.45);
    const fitted = await sharp(Buffer.from(logoImage.data, "base64"))
      .resize(boxSize, boxSize, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png()
      .toBuffer();
    const p = pos("logo", { x: 50, y: 35 });
    const x = Math.round((p.x / 100) * canvasW - boxSize / 2);
    const y = Math.round((p.y / 100) * canvasH - boxSize / 2);
    logoElement = `<image x="${x}" y="${y}" width="${boxSize}" height="${boxSize}" href="data:image/png;base64,${fitted.toString(
      "base64"
    )}" />`;
  }

  const textElements: string[] = [];
  if (monogram.trim()) {
    const p = pos("monogram", { x: 50, y: 15 });
    textElements.push(
      `<text x="${(p.x / 100) * canvasW}" y="${(p.y / 100) * canvasH}" font-size="${canvasH * 0.14}" font-family="Georgia, 'Times New Roman', serif" fill="${inkColor}" text-anchor="middle" dominant-baseline="central">${escapeXml(monogram)}</text>`
    );
  }
  if (names.trim()) {
    const p = pos("names", { x: 50, y: 65 });
    textElements.push(
      `<text x="${(p.x / 100) * canvasW}" y="${(p.y / 100) * canvasH}" font-size="${canvasH * 0.11}" font-family="Georgia, 'Times New Roman', serif" fill="${inkColor}" text-anchor="middle" dominant-baseline="central">${escapeXml(names.trim())}</text>`
    );
  }
  if (date.trim()) {
    const p = pos("date", { x: 50, y: 82 });
    textElements.push(
      `<text x="${(p.x / 100) * canvasW}" y="${(p.y / 100) * canvasH}" font-size="${canvasH * 0.05}" font-family="Georgia, 'Times New Roman', serif" letter-spacing="1" fill="${inkColor}" text-anchor="middle" dominant-baseline="central">${escapeXml(date.trim())}</text>`
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
// resize-kernel ringing/haloing that was leaving a faint white "shadow"
// around engraved text edges.
async function compositePersonalization(
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

function buildLogoRestylePrompt(finish: string, colorMode: string, techniqueName: string) {
  return `You are preparing artwork for physical ${techniqueName} printing. The attached image is source artwork (it may be a logo, illustration, or photo).

Redraw it as it would look rendered with ${finish}, matching the ${techniqueName} technique.

CRITICAL COLOR RULE: ${colorMode}

Output ONLY the artwork itself: tightly cropped to its content with a small margin, centered, on a plain flat WHITE background. Do not include any product, mockup, scene, shadow, or extra elements — just the standalone artwork on white, as print-ready camera-ready art.

${SINGLE_IMAGE_RULE}`;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI rendering isn't configured yet (missing GEMINI_API_KEY)." },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => null);
  const productId: string | undefined = body?.productId;
  const names: string = body?.names ?? "";
  const date: string = body?.date ?? "";
  const monogram: string = body?.monogram ?? "";
  const logoDataUrl: string | undefined = body?.logoDataUrl;
  const sizeScale: number = typeof body?.sizeScale === "number" ? body.sizeScale : 1;
  const positions: Record<string, Corner> = body?.positions ?? {};
  const requestedImageId: string | undefined = body?.imageId;

  if (!productId) {
    return NextResponse.json({ error: "Missing productId." }, { status: 400 });
  }

  const [{ data: product }, { data: techniqueCatalog }] = await Promise.all([
    supabase
      .from("products")
      .select(
        `name,
         images:product_images ( id, url, sort_order ),
         zones:product_print_zones ( image_id, corners_pct ),
         techniques:product_print_techniques ( technique, is_default )`
      )
      .eq("id", productId)
      .maybeSingle(),
    supabase.from("print_techniques").select("name, finish_description, color_mode_description, strip_source_color"),
  ]);

  if (!product) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }

  const images = (product.images ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);
  const rawZone = product.zones?.[0];
  const zone: PrintZone | undefined = rawZone
    ? { corners_pct: (rawZone.corners_pct as Corner[] | null) ?? [] }
    : undefined;
  const referenceImage =
    images.find((i) => i.id === requestedImageId) ?? images.find((i) => i.id === rawZone?.image_id) ?? images[0];
  if (!referenceImage) {
    return NextResponse.json({ error: "This product has no photo to render on." }, { status: 400 });
  }
  const technique = (product.techniques ?? []).find((t) => t.is_default) ?? product.techniques?.[0];

  const baseImage = await loadImageAsBase64(referenceImage.url);
  if (!baseImage) {
    return NextResponse.json({ error: "Could not load the product photo." }, { status: 502 });
  }
  const croppedBase = await cropToStorefrontAspect(baseImage);

  let logoImage: ImagePayload | null = null;
  if (logoDataUrl?.startsWith("data:")) {
    const match = /^data:(.+);base64,(.*)$/.exec(logoDataUrl);
    if (match) logoImage = { mimeType: match[1], data: match[2] };
  }

  const techniqueMeta = technique
    ? (techniqueCatalog ?? []).find((t) => t.name === technique.technique)
    : undefined;

  if (logoImage && techniqueMeta?.strip_source_color) {
    logoImage = await toGrayscale(logoImage);
  }
  const finish = techniqueMeta?.finish_description ?? FALLBACK_FINISH;
  const colorMode = techniqueMeta?.color_mode_description ?? FALLBACK_COLOR_MODE;
  const inkColor = techniqueInkColor(technique?.technique);

  // Restyling just the logo (a small, well-scoped image-to-image task) is
  // far more reliable for the model than editing the whole product photo
  // and hoping it respects placement. If this call fails, fall back to the
  // (already grayscaled, if applicable) original logo rather than failing
  // the whole render.
  let artworkLogoImage: ImagePayload | null = null;
  if (logoImage) {
    const restylePrompt = buildLogoRestylePrompt(finish, colorMode, technique?.technique ?? "printed");
    const restyleResult = await callGemini(apiKey, restylePrompt, [logoImage]);
    artworkLogoImage = "image" in restyleResult ? restyleResult.image : logoImage;
  }

  const photoMeta = await sharp(Buffer.from(croppedBase.data, "base64")).metadata();
  const photoW = photoMeta.width ?? 1000;
  const photoH = photoMeta.height ?? 1250;

  const box =
    zone && zone.corners_pct.length === 4
      ? boundingBoxPx(zone.corners_pct, photoW, photoH)
      : { left: photoW * 0.25, top: photoH * 0.3, width: photoW * 0.5, height: photoH * 0.3 };

  const targetW = Math.max(1, Math.round(box.width * sizeScale));
  const targetH = Math.max(1, Math.round(box.height * sizeScale));

  const artworkBuffer = await buildArtworkImage({
    canvasW: targetW,
    canvasH: targetH,
    logoImage: artworkLogoImage,
    positions,
    names,
    date,
    monogram,
    inkColor,
  });

  const productResultImage = await compositePersonalization(croppedBase, artworkBuffer, box, targetW, targetH);
  const productImageDataUrl = `data:${productResultImage.mimeType};base64,${productResultImage.data}`;

  // Second pass: place the now-personalized product (accurately composited,
  // not AI-guessed) into a realistic wedding lifestyle scene.
  const contextPrompt = `You are a product photographer for a wedding merchandise brand. The attached image is a personalized product that has already been finalized — its shape, material, color, and personalization must be reproduced exactly as shown, pixel-faithful, with the personalization clearly legible.

Reimagine this exact product inside a realistic, elegant wedding lifestyle scene appropriate for this kind of item — for example displayed on a reception or welcome table with soft natural light and understated floral styling, or naturally held/used during a wedding moment. Keep the product and its personalization completely unchanged; only the surrounding environment, framing, and lighting context should differ from the input.

${SINGLE_IMAGE_RULE} No text captions, no watermarks, no collage of multiple angles — one full-bleed lifestyle photograph.`;

  const contextResult = await callGemini(apiKey, contextPrompt, [productResultImage]);
  const contextImageDataUrl =
    "image" in contextResult ? `data:${contextResult.image.mimeType};base64,${contextResult.image.data}` : null;

  return NextResponse.json({ imageDataUrl: productImageDataUrl, contextImageDataUrl });
}
