import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

const FALLBACK_FINISH = "a clean printed finish";
const FALLBACK_COLOR_MODE = "Match the color treatment to a realistic printed finish.";

// Any output must be a single, edge-to-edge photograph — image-editing
// models will sometimes "helpfully" produce a moodboard/collage of several
// small mockups instead of one edited photo, which is unusable here.
const SINGLE_IMAGE_RULE =
  "Output exactly ONE photograph that fills the entire frame edge-to-edge. Never produce a collage, grid, moodboard, multiple thumbnails, side-by-side variations, empty margins/borders, or any UI chrome — just one single, full-bleed photo.";

type PrintZone = {
  pos_x_pct: number;
  pos_y_pct: number;
  width_pct: number;
  height_pct: number;
  rotation_deg: number | null;
};
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
    const rotation = zone.rotation_deg ?? 0;
    const cx = x + rectW / 2;
    const cy = y + rectH / 2;

    // No fill — only a thin dashed outline. A filled tint gave the model a
    // colored patch to (sometimes) leave a residue of in the output; an
    // outline-only guide is both enough to communicate the boundary and
    // easier for the model to fully erase.
    const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${x}" y="${y}" width="${rectW}" height="${rectH}"
        transform="rotate(${rotation} ${cx} ${cy})"
        fill="none" stroke="rgb(255,0,80)" stroke-width="${strokeWidth}"
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
  const positions: Record<string, { x: number; y: number }> = body?.positions ?? {};
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
         zones:product_print_zones ( image_id, pos_x_pct, pos_y_pct, width_pct, height_pct, rotation_deg, width_mm, height_mm ),
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
  const zone = product.zones?.[0];
  const referenceImage =
    images.find((i) => i.id === requestedImageId) ?? images.find((i) => i.id === zone?.image_id) ?? images[0];
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

  const techniqueMeta = technique
    ? (techniqueCatalog ?? []).find((t) => t.name === technique.technique)
    : undefined;

  if (logoImage && techniqueMeta?.strip_source_color) {
    logoImage = await toGrayscale(logoImage);
  }
  const finish = techniqueMeta?.finish_description ?? FALLBACK_FINISH;
  const colorMode = techniqueMeta?.color_mode_description ?? FALLBACK_COLOR_MODE;
  // The customer drags each element (logo, monogram, names, date)
  // independently on a live preview of the print area, so their exact
  // relative position within that rectangle is described per-element here
  // rather than as one shared alignment for the whole personalization.
  function bucketH(pct: number): "left" | "center" | "right" {
    if (pct < 33) return "left";
    if (pct > 66) return "right";
    return "center";
  }
  function bucketV(pct: number): "top" | "center" | "bottom" {
    if (pct < 33) return "top";
    if (pct > 66) return "bottom";
    return "center";
  }
  function describePos(pos?: { x: number; y: number }): string {
    if (!pos) return "centered";
    const h = bucketH(pos.x);
    const v = bucketV(pos.y);
    if (h === "center" && v === "center") return "centered";
    if (v === "center") return `toward the ${h} side`;
    if (h === "center") return `toward the ${v}`;
    return `toward the ${v}-${h}`;
  }

  const elementDescriptions: string[] = [];
  if (logoDataUrl && positions.logo) {
    elementDescriptions.push(`the logo/artwork is placed ${describePos(positions.logo)} of the rectangle`);
  }
  if (monogram.trim() && positions.monogram) {
    elementDescriptions.push(`the monogram is placed ${describePos(positions.monogram)} of the rectangle`);
  }
  if (names.trim() && positions.names) {
    elementDescriptions.push(`the text "${names.trim()}" is placed ${describePos(positions.names)} of the rectangle`);
  }
  if (date.trim() && positions.date) {
    elementDescriptions.push(`the date is placed ${describePos(positions.date)} of the rectangle`);
  }

  const alignPhrase =
    elementDescriptions.length > 0
      ? `Each personalization element keeps its own exact relative position within that rectangle, matching what the customer arranged: ${elementDescriptions.join(
          "; "
        )}. Preserve the relative spacing between elements — do not merge, center, or re-stack them together`
      : "centered within that rectangle";

  const rotation = zone?.rotation_deg ?? 0;
  const rotationPhrase =
    Math.abs(rotation) >= 1
      ? ` The rectangle itself is drawn rotated ${Math.abs(rotation)}° ${
          rotation > 0 ? "clockwise" : "counter-clockwise"
        } to match the angle of that surface in the photo (e.g. a lid or panel shown at an angle) — the personalization must follow that same rotated angle, sitting flush and flat on that surface exactly as the rotated rectangle shows, not upright relative to the overall photo frame.`
      : "";

  const region = zone
    ? `The input photo has a dashed magenta/pink guide OUTLINE (no fill) marking the exact printable area. That marked rectangle is the ONLY place the personalization may appear — it must not extend past the rectangle's edges in any direction, even if that means rendering the personalization smaller than you otherwise would. Place the personalization ${alignPhrase}.${rotationPhrase} The rectangle corresponds to a real printable zone of ${
        zone.width_mm ?? "?"
      }mm by ${
        zone.height_mm ?? "?"
      }mm, so keep the personalization's scale proportionate to that rectangle.${
        sizeScale > 1.05
          ? ` The customer asked for the personalization to be rendered larger than the default fit — size it to about ${Math.round(
              sizeScale * 100
            )}% of the default scale while still staying fully inside the rectangle.`
          : sizeScale < 0.95
          ? ` The customer asked for the personalization to be rendered smaller than the default fit — size it to about ${Math.round(
              sizeScale * 100
            )}% of the default scale.`
          : ""
      } CRITICAL: the dashed magenta guide line is only a temporary annotation for you, the editor — it must be 100% absent from your output. Do not leave any dashed line, solid line, colored tint, faint outline, or box-shaped discoloration anywhere in the image. The area inside and around where the guide was must show only the product's real, undisturbed material, color, and lighting, exactly matching the untouched surrounding surface, with the personalization sitting directly on top of it as if it were physically printed there.`
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

Render the personalization with ${finish}, matching the print technique "${technique?.technique ?? "printed"}".

CRITICAL COLOR RULE: ${colorMode}

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
