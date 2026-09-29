import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { techniqueInkColor } from "@/lib/printTechniqueColors";
import { type Corner, type ImagePayload, type PrintZone, type ElemKey, toGrayscale, composeProductPersonalization } from "@/lib/personalizationComposite";

export const runtime = "nodejs";

// A plain, deterministic snapshot of exactly what the customer configured —
// no Gemini calls, no rate limit. Generated on every add-to-cart (when the
// item is personalized) so suppliers and admins always have a visual record
// of the order, even if the customer never used the optional AI preview.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const productId: string | undefined = body?.productId;
  const names: string = body?.names ?? "";
  const date: string = body?.date ?? "";
  const monogram: string = body?.monogram ?? "";
  const frame: string = body?.frame ?? "";
  const textFont: string = body?.textFont ?? "";
  const logoDataUrl: string | undefined = body?.logoDataUrl;
  const positions: Record<string, Corner> = body?.positions ?? {};
  const elemScale: Partial<Record<ElemKey, number>> = body?.elemScale ?? {};
  const elemRotationOffsetDeg: Partial<Record<ElemKey, number>> = body?.elemRotationOffsetDeg ?? {};
  const requestedImageId: string | undefined = body?.imageId;
  const requestedZoneId: string | undefined = body?.zoneId;
  // Which technique the customer actually has selected right now — without
  // this the route always fell back to the product's DB-default technique,
  // which can silently differ from what's live on the customer's screen.
  const requestedTechnique: string | undefined = body?.technique;
  // The customer's own effective colors (already resolved client-side the
  // same way the live Design canvas renders them — see effectiveColorsFor
  // in ProductConfigurator.tsx). Optional so older callers still work,
  // falling back to a technique-derived default below.
  const clientInkColor: string | undefined = body?.inkColor;
  const clientNamesColor: string | undefined = body?.namesColor;
  const clientDateColor: string | undefined = body?.dateColor;
  const clientMonogramColor: string | undefined = body?.monogramColor;
  const clientFrameColor: string | undefined = body?.frameColor;

  if (!productId) {
    return NextResponse.json({ error: "Missing productId." }, { status: 400 });
  }

  const [{ data: product }, { data: techniqueCatalog }] = await Promise.all([
    supabase
      .from("products")
      .select(
        `images:product_images ( id, url, sort_order ),
         zones:product_print_zones ( id, image_id, corners_pct, width_mm, height_mm, sort_order ),
         techniques:product_print_techniques ( technique, is_default )`
      )
      .eq("id", productId)
      .maybeSingle(),
    supabase.from("print_techniques").select("name, strip_source_color"),
  ]);

  if (!product) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }

  const images = (product.images ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);
  const zones = (product.zones ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);
  // Which print area this snapshot is for — the requested one (a shopper's
  // added secondary/tertiary area has its own geometry, distinct from the
  // primary) or the primary area when none is specified.
  const rawZone = zones.find((z) => z.id === requestedZoneId) ?? zones[0];
  const zone: PrintZone | undefined = rawZone
    ? { corners_pct: (rawZone.corners_pct as Corner[] | null) ?? [], width_mm: rawZone.width_mm, height_mm: rawZone.height_mm }
    : undefined;
  const referenceImage =
    images.find((i) => i.id === requestedImageId) ?? images.find((i) => i.id === rawZone?.image_id) ?? images[0];
  if (!referenceImage) {
    return NextResponse.json({ error: "This product has no photo to render on." }, { status: 400 });
  }
  // Prefer the technique the customer actually has selected right now
  // (sent by the client) over the product's DB-configured default — this
  // route previously always used the default technique regardless of what
  // was live on screen, which could pick the wrong fixed ink/strip-color
  // behavior whenever the customer had switched to a non-default technique.
  const technique =
    (product.techniques ?? []).find((t) => t.technique === requestedTechnique) ??
    (product.techniques ?? []).find((t) => t.is_default) ??
    product.techniques?.[0];
  const techniqueMeta = technique ? (techniqueCatalog ?? []).find((t) => t.name === technique.technique) : undefined;

  let logoImage: ImagePayload | null = null;
  if (logoDataUrl?.startsWith("data:")) {
    const match = /^data:(.+);base64,(.*)$/.exec(logoDataUrl);
    if (match) logoImage = { mimeType: match[1], data: match[2] };
  }
  if (logoImage && techniqueMeta?.strip_source_color) {
    logoImage = await toGrayscale(logoImage);
  }

  // The client already resolves the customer's real effective colors the
  // same way the live Design canvas does (see effectiveColorsFor in
  // ProductConfigurator.tsx) — using those directly instead of re-deriving
  // color from the technique here keeps this route from drifting out of
  // sync with the canvas again. The technique-derived color is kept only
  // as a fallback for any caller that doesn't send one.
  const inkColor = clientInkColor ?? techniqueInkColor(technique?.technique);

  const result = await composeProductPersonalization({
    referenceImageUrl: referenceImage.url,
    zone,
    logoImage,
    positions,
    names,
    date,
    monogram,
    frame,
    textFont,
    inkColor,
    namesColor: clientNamesColor,
    dateColor: clientDateColor,
    monogramColor: clientMonogramColor,
    frameColor: clientFrameColor,
    elemScale,
    elemRotationOffsetDeg,
  });
  if (!result) {
    return NextResponse.json({ error: "Could not load the product photo." }, { status: 502 });
  }

  return NextResponse.json({ imageDataUrl: `data:${result.mimeType};base64,${result.data}` });
}
