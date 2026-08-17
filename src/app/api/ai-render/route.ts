import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { techniqueInkColor } from "@/lib/printTechniqueColors";
import {
  type Corner,
  type PrintZone,
  type ImagePayload,
  toGrayscale,
  composeProductPersonalization,
} from "@/lib/personalizationComposite";

export const runtime = "nodejs";

const FALLBACK_FINISH = "a clean printed finish";
const FALLBACK_COLOR_MODE = "Match the color treatment to a realistic printed finish.";

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

  const productResultImage = await composeProductPersonalization({
    referenceImageUrl: referenceImage.url,
    zone,
    logoImage: artworkLogoImage,
    positions,
    names,
    date,
    monogram,
    inkColor,
    sizeScale,
  });
  if (!productResultImage) {
    return NextResponse.json({ error: "Could not load the product photo." }, { status: 502 });
  }
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
