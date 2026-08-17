import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
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

async function loadImageAsBase64(url: string): Promise<{ data: string; mimeType: string } | null> {
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

  let logoImage: { data: string; mimeType: string } | null = null;
  if (logoDataUrl?.startsWith("data:")) {
    const match = /^data:(.+);base64,(.*)$/.exec(logoDataUrl);
    if (match) logoImage = { mimeType: match[1], data: match[2] };
  }

  const finish = technique ? TECHNIQUE_FINISH[technique.technique] ?? "a clean printed finish" : "a clean printed finish";
  const region = zone
    ? `The personalization must be placed only within the region located approximately ${zone.pos_x_pct.toFixed(
        0
      )}% from the left and ${zone.pos_y_pct.toFixed(0)}% from the top of the photo, spanning about ${zone.width_pct.toFixed(
        0
      )}% of the photo's width and ${zone.height_pct.toFixed(0)}% of its height. In real life that print area measures ${
        zone.width_mm ?? "?"
      }mm by ${zone.height_mm ?? "?"}mm, so keep the personalization proportionate to that size relative to the product.`
    : "Place the personalization in the natural, obvious spot for this kind of product.";

  const contentInstruction = logoImage
    ? "Apply the provided logo image (the second image) onto the product, replacing nothing else in the scene."
    : `Add the following text onto the product, in an elegant serif style consistent with wedding stationery: "${names}"${
        date ? ` and the date "${date}"` : ""
      }${monogram ? `, near a small monogram-style ornament` : ""}.`;

  const prompt = `You are editing a real product photography image for a wedding merchandise brand. Do not change anything about the product, background, lighting, shadows, or composition except for the personalization described below.

${contentInstruction}

${region}

Render the personalization with ${finish}, matching the print technique "${technique?.technique ?? "printed"}". The result must look like authentic product photography, not a flat sticker — respect the surface curvature, lighting direction, and material of the product in the original photo.`;

  const parts: Record<string, unknown>[] = [{ text: prompt }];
  parts.push({ inline_data: { mime_type: baseImage.mimeType, data: baseImage.data } });
  if (logoImage) parts.push({ inline_data: { mime_type: logoImage.mimeType, data: logoImage.data } });

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
      return NextResponse.json({ error: `AI render failed: ${errText.slice(0, 300)}` }, { status: 502 });
    }

    const json = await geminiRes.json();
    const resultParts = json?.candidates?.[0]?.content?.parts ?? [];
    const imagePart = resultParts.find((p: { inlineData?: { data?: string } }) => p.inlineData?.data);

    if (!imagePart?.inlineData?.data) {
      return NextResponse.json({ error: "The model didn't return an image. Try again." }, { status: 502 });
    }

    const mimeType = imagePart.inlineData.mimeType ?? "image/png";
    return NextResponse.json({ imageDataUrl: `data:${mimeType};base64,${imagePart.inlineData.data}` });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "AI render failed." },
      { status: 500 }
    );
  }
}
