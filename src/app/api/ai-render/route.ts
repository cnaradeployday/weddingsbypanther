import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { supabase } from "@/lib/supabase";
import { techniqueInkColor } from "@/lib/printTechniqueColors";
import {
  type Corner,
  type PrintZone,
  type ImagePayload,
  type ElemKey,
  toGrayscale,
  composeProductPersonalization,
} from "@/lib/personalizationComposite";

export const runtime = "nodejs";

// Any output must be a single, edge-to-edge photograph — image-editing
// models will sometimes "helpfully" produce a moodboard/collage of several
// small mockups instead of one edited photo, which is unusable here.
const SINGLE_IMAGE_RULE =
  "Output exactly ONE photograph that fills the entire frame edge-to-edge. Never produce a collage, grid, moodboard, multiple thumbnails, side-by-side variations, empty margins/borders, or any UI chrome — just one single, full-bleed photo.";

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

// Frames the already-correct, personalized product photo as a small white-
// bordered card with a soft drop shadow, then composites it onto a
// generated background — deterministic pixel math, not a model repainting
// the product. This is what keeps the wedding-context shot from ever
// risking the personalization text (see compositeOnBackground below).
async function compositeOnBackground(background: ImagePayload, product: ImagePayload): Promise<ImagePayload> {
  const bgImage = sharp(Buffer.from(background.data, "base64"));
  const bgMeta = await bgImage.metadata();
  const bgW = bgMeta.width ?? 1000;
  const bgH = bgMeta.height ?? 1250;

  const cardW = Math.round(bgW * 0.46);
  const border = Math.max(4, Math.round(cardW * 0.035));
  const innerW = cardW - border * 2;
  const innerH = Math.round((innerW * 5) / 4); // product photo is 4:5 (w:h)
  const cardH = innerH + border * 2;

  const resizedProduct = await sharp(Buffer.from(product.data, "base64"))
    .resize(innerW, innerH, { fit: "cover" })
    .png()
    .toBuffer();

  const framedCard = await sharp({
    create: { width: cardW, height: cardH, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  })
    .composite([{ input: resizedProduct, left: border, top: border }])
    .png()
    .toBuffer();

  const shadowPad = 40;
  const shadowSvg = `<svg width="${cardW + shadowPad * 2}" height="${cardH + shadowPad * 2}" xmlns="http://www.w3.org/2000/svg"><rect x="${shadowPad}" y="${shadowPad + 8}" width="${cardW}" height="${cardH}" fill="black" opacity="0.32" /></svg>`;
  const shadow = await sharp(Buffer.from(shadowSvg)).blur(16).png().toBuffer();

  const left = Math.round((bgW - cardW) / 2);
  const top = Math.round(bgH * 0.55 - cardH / 2);

  const composited = await bgImage
    .composite([
      { input: shadow, left: left - shadowPad, top: top - shadowPad },
      { input: framedCard, left, top },
    ])
    .png()
    .toBuffer();

  return { data: composited.toString("base64"), mimeType: "image/png" };
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
  const positions: Record<string, Corner> = body?.positions ?? {};
  const elemScale: Partial<Record<ElemKey, number>> = body?.elemScale ?? {};
  const elemRotationOffsetDeg: Partial<Record<ElemKey, number>> = body?.elemRotationOffsetDeg ?? {};
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
         zones:product_print_zones ( image_id, corners_pct, width_mm, height_mm ),
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
    ? { corners_pct: (rawZone.corners_pct as Corner[] | null) ?? [], width_mm: rawZone.width_mm, height_mm: rawZone.height_mm }
    : undefined;
  const referenceImage =
    images.find((i) => i.id === requestedImageId) ?? images.find((i) => i.id === rawZone?.image_id) ?? images[0];
  if (!referenceImage) {
    return NextResponse.json({ error: "This product has no photo to render on." }, { status: 400 });
  }
  const technique = (product.techniques ?? []).find((t) => t.is_default) ?? product.techniques?.[0];

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
  const inkColor = techniqueInkColor(technique?.technique);

  // The logo is composited exactly as uploaded (grayscaled above when the
  // technique calls for it) — no generative "redraw it in this finish"
  // pass. Asking an image model to redraw arbitrary source artwork risks
  // it hallucinating/garbling any text baked into the logo, which is worse
  // than skipping the cosmetic restyle.
  const productResultImage = await composeProductPersonalization({
    referenceImageUrl: referenceImage.url,
    zone,
    logoImage,
    positions,
    names,
    date,
    monogram,
    inkColor,
    elemScale,
    elemRotationOffsetDeg,
  });
  if (!productResultImage) {
    return NextResponse.json({ error: "Could not load the product photo." }, { status: 502 });
  }
  const productImageDataUrl = `data:${productResultImage.mimeType};base64,${productResultImage.data}`;

  // Second pass: Gemini generates an EMPTY wedding lifestyle scene — no
  // product, no text — which is then deterministically composited with the
  // already-correct personalized photo (compositeOnBackground). Earlier
  // versions asked Gemini to redraw the personalized product "unchanged"
  // into a new scene; image-generation models cannot reliably preserve
  // exact text through a full repaint and would hallucinate/garble it.
  // Never showing Gemini the personalization at all removes that risk
  // entirely, the same reasoning that moved text/logo placement off AI.
  const backgroundPrompt = `Generate a realistic, elegant wedding reception or welcome table photograph — softly lit, tastefully styled with understated florals and neutral linens, shot at a slight angle as if for a lifestyle product catalog. Leave an open, uncluttered area in the lower-middle of the frame, as if a small gift or favor is about to be set down there. Do not include any gift, box, favor, product, sign, or text anywhere in the image — just the empty styled table and ambiance.

${SINGLE_IMAGE_RULE} No text captions, no watermarks, no collage of multiple angles — one full-bleed photograph.`;

  const backgroundResult = await callGemini(apiKey, backgroundPrompt, []);
  let contextImageDataUrl: string | null = null;
  if ("image" in backgroundResult) {
    const composed = await compositeOnBackground(backgroundResult.image, productResultImage);
    contextImageDataUrl = `data:${composed.mimeType};base64,${composed.data}`;
  }

  return NextResponse.json({ imageDataUrl: productImageDataUrl, contextImageDataUrl });
}
