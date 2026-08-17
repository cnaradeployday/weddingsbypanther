import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

const TECHNIQUE_FINISH: Record<string, string> = {
  "Foil stamp": "a metallic foil finish that catches light with a subtle reflective sheen",
  "Laser engrave": "a subtly debossed, burned-in engraved look with soft inner shadow, no ink color",
  "Screen print": "a flat, matte, opaque layer of ink sitting on the surface",
  Letterpress: "a gently pressed impression into the material with soft shadowed edges",
  "UV print": "a glossy, slightly raised printed finish",
  Embroidery: "a stitched thread texture with visible individual stitches and slight dimensional thickness",
  "Wax seal": "an embossed wax seal texture in a solid wax color",
};

// How much of the source artwork's original color/detail should survive the
// print technique. Most physical techniques cannot reproduce full-color
// photography, so uploaded photos/logos must be reduced accordingly.
const TECHNIQUE_COLOR_MODE: Record<string, string> = {
  "Foil stamp":
    "Render the artwork as a single solid metallic tone (gold, silver, or rose gold — pick whichever fits the product) with no gradients. Completely discard the original artwork's colors, including any skin tones, background colors, or photo shading.",
  "Laser engrave":
    "Render the artwork as a monochrome engraved mark in the product material's own color (burned/etched, no ink, no color). Completely discard the original artwork's colors, including any skin tones, background colors, or photo shading — a photo becomes a grayscale-derived engraved silhouette/line art, never a color image.",
  "Screen print":
    "Reduce the artwork to 1-2 flat solid spot colors, as real screen printing would use. Do not attempt full photographic color or smooth gradients.",
  Letterpress:
    "Render the artwork as a single-color pressed impression (ink or blind emboss). Completely discard the original artwork's colors.",
  "UV print":
    "Reproduce the artwork in full, accurate photographic color and detail — UV printing supports true color reproduction.",
  Embroidery:
    "Simplify the artwork into a stitched design using at most 4-6 thread colors with visible thread texture. Do not attempt photographic detail, fine gradients, or the original color palette.",
  "Wax seal":
    "Render the artwork as a raised, monochrome wax-seal impression in a single wax color. Completely discard the original artwork's colors.",
};

// Any output must be a single, edge-to-edge photograph — image-editing
// models will sometimes "helpfully" produce a moodboard/collage of several
// small mockups instead of one edited photo, which is unusable here.
const SINGLE_IMAGE_RULE =
  "Output exactly ONE photograph that fills the entire frame edge-to-edge. Never produce a collage, grid, moodboard, multiple thumbnails, side-by-side variations, empty margins/borders, or any UI chrome — just one single, full-bleed photo.";

type PrintZone = { pos_x_pct: number; pos_y_pct: number; width_pct: number; height_pct: number };
type ImagePayload = { data: string; mimeType: string };

// Matches the aspect-[4/5] + object-cover box used everywhere the product
// photo is shown (the admin print-area tool and the storefront product
// page). pos_x_pct/width_pct etc. are calibrated by eye against that
// cropped view, not the raw uploaded photo, so this same center-crop must
// be applied before those percentages are turned into pixels — otherwise
// the guide rectangle (and therefore the AI render) lands on a different
// part of the photo than what was actually configured.
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

// Draws a visible dashed guide rectangle over the printable area on the base
// photo. Image-editing models follow a visual mask far more reliably than a
// text description of percentages, so this is what keeps the AI render
// inside the actual print area instead of drifting outside it.
async function withPrintAreaGuide(base: ImagePayload, zone: PrintZone | undefined): Promise<ImagePayload> {
  if (!zone) return base;
  try {
    const buffer = Buffer.from(base.data, "base64");
    const image = sharp(buffer);
    const { width, height } = await image.metadata();
    if (!width || !height) return base;

    const x = Math.round((zone.pos_x_pct / 100) * width);
    const y = Math.round((zone.pos_y_pct / 100) * height);
    const rectW = Math.max(1, Math.round((zone.width_pct / 100) * width));
    const rectH = Math.max(1, Math.round((zone.height_pct / 100) * height));
    const strokeWidth = Math.max(3, Math.round(width * 0.004));

    const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${x}" y="${y}" width="${rectW}" height="${rectH}"
        fill="rgba(255,0,80,0.10)" stroke="rgb(255,0,80)" stroke-width="${strokeWidth}"
        stroke-dasharray="${strokeWidth * 4},${strokeWidth * 2.5}" />
    </svg>`;

    const composited = await image
      .composite([{ input: Buffer.from(svg), left: 0, top: 0 }])
      .png()
      .toBuffer();

    return { data: composited.toString("base64"), mimeType: "image/png" };
  } catch {
    return base;
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

  if (!productId) {
    return NextResponse.json({ error: "Missing productId." }, { status: 400 });
  }

  const { data: product } = await supabase
    .from("products")
    .select(
      `name,
       images:product_images ( id, url, sort_order ),
       zones:product_print_zones ( image_id, pos_x_pct, pos_y_pct, width_pct, height_pct, width_mm, height_mm ),
       techniques:product_print_techniques ( technique, is_default )`
    )
    .eq("id", productId)
    .maybeSingle();

  if (!product) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }

  const images = (product.images ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);
  const zone = product.zones?.[0];
  const referenceImage = images.find((i) => i.id === zone?.image_id) ?? images[0];
  if (!referenceImage) {
    return NextResponse.json({ error: "This product has no photo to render on." }, { status: 400 });
  }
  const technique = (product.techniques ?? []).find((t) => t.is_default) ?? product.techniques?.[0];

  const baseImage = await loadImageAsBase64(referenceImage.url);
  if (!baseImage) {
    return NextResponse.json({ error: "Could not load the product photo." }, { status: 502 });
  }
  const croppedBase = await cropToStorefrontAspect(baseImage);
  const guidedImage = await withPrintAreaGuide(croppedBase, zone);

  let logoImage: ImagePayload | null = null;
  if (logoDataUrl?.startsWith("data:")) {
    const match = /^data:(.+);base64,(.*)$/.exec(logoDataUrl);
    if (match) logoImage = { mimeType: match[1], data: match[2] };
  }

  const finish = technique ? TECHNIQUE_FINISH[technique.technique] ?? "a clean printed finish" : "a clean printed finish";
  const colorMode = technique
    ? TECHNIQUE_COLOR_MODE[technique.technique] ??
      "Match the color treatment to a realistic version of this print technique."
    : "Match the color treatment to a realistic printed finish.";
  const region = zone
    ? `The input photo has a dashed magenta/pink guide rectangle marking the exact printable area. That marked rectangle is the ONLY place the personalization may appear — it must not extend past the rectangle's edges in any direction, even if that means rendering the personalization smaller than you otherwise would. The rectangle corresponds to a real printable zone of ${
        zone.width_mm ?? "?"
      }mm by ${
        zone.height_mm ?? "?"
      }mm, so keep the personalization's scale proportionate to that rectangle. The guide rectangle itself is only a temporary annotation: it must NOT appear in your output image — remove it completely and replace that area with the product's real material/surface plus the personalization.${
        sizeScale > 1.05
          ? ` The customer asked for the personalization to be rendered larger than the default fit — size it to about ${Math.round(
              sizeScale * 100
            )}% of the default scale while still staying fully inside the rectangle.`
          : sizeScale < 0.95
          ? ` The customer asked for the personalization to be rendered smaller than the default fit — size it to about ${Math.round(
              sizeScale * 100
            )}% of the default scale.`
          : ""
      }`
    : "Place the personalization in the natural, obvious spot for this kind of product.";

  const hasText = names.trim().length > 0 || date.trim().length > 0;
  const textPieces = [names.trim() && `the text "${names.trim()}"`, date.trim() && `the date "${date.trim()}"`].filter(
    Boolean
  );

  let contentInstruction: string;
  if (logoImage) {
    contentInstruction =
      "The second attached image is source artwork to personalize the product with (it may be a logo, illustration, or photo, e.g. of a couple). Extract its shape and content, then re-render it directly onto the product using the print technique described below — do not simply paste, overlay, or sticker the original image's pixels, colors, or shading onto the product.";
    if (hasText) {
      contentInstruction += ` Also add ${textPieces.join(
        " and "
      )} as elegant serif text, arranged naturally alongside the artwork (e.g. beneath or beside it) within the same printable area${
        monogram ? ", near a small monogram-style ornament" : ""
      } — do not omit this text.`;
    }
  } else {
    contentInstruction = `Add the following onto the product, in an elegant serif style consistent with wedding stationery: ${
      textPieces.join(" and ") || `the text "${names}"`
    }${monogram ? `, near a small monogram-style ornament` : ""}.`;
  }

  const productPrompt = `You are editing a real product photography image for a wedding merchandise brand. This is a precise, surgical edit: keep the exact same product, background, lighting, shadows, camera angle, zoom level, and composition as the input photo. The only changes allowed are: removing the guide rectangle described below, and adding the personalization described below strictly inside it.

${contentInstruction}

${region}

Render the personalization with ${finish}, matching the print technique "${technique?.technique ?? "printed"}". ${colorMode}

The result must look like authentic, unedited product photography — same framing as the input, not zoomed in or cropped — with no trace of the guide rectangle. Respect the surface curvature, lighting direction, and material of the product in the original photo.

${SINGLE_IMAGE_RULE}`;

  const productImages: ImagePayload[] = [guidedImage];
  if (logoImage) productImages.push(logoImage);

  const productResult = await callGemini(apiKey, productPrompt, productImages);
  if ("error" in productResult) {
    return NextResponse.json({ error: productResult.error }, { status: 502 });
  }

  const productImageDataUrl = `data:${productResult.image.mimeType};base64,${productResult.image.data}`;

  // Second pass: place the now-personalized product into a realistic wedding
  // lifestyle scene, chaining off the first result so the product and its
  // personalization stay identical — only the surrounding context changes.
  const contextPrompt = `You are a product photographer for a wedding merchandise brand. The attached image is a personalized product that has already been finalized — its shape, material, color, and personalization (the ${
    logoImage ? "logo/artwork" : "text"
  } applied with ${finish}) must be reproduced exactly as shown, pixel-faithful, with the personalization clearly legible.

Reimagine this exact product inside a realistic, elegant wedding lifestyle scene appropriate for this kind of item — for example displayed on a reception or welcome table with soft natural light and understated floral styling, or naturally held/used during a wedding moment. Keep the product and its personalization completely unchanged; only the surrounding environment, framing, and lighting context should differ from the input.

${SINGLE_IMAGE_RULE} No text captions, no watermarks, no collage of multiple angles — one full-bleed lifestyle photograph.`;

  const contextResult = await callGemini(apiKey, contextPrompt, [productResult.image]);
  const contextImageDataUrl =
    "image" in contextResult ? `data:${contextResult.image.mimeType};base64,${contextResult.image.data}` : null;

  return NextResponse.json({ imageDataUrl: productImageDataUrl, contextImageDataUrl });
}
