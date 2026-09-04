import { NextRequest, NextResponse } from "next/server";
import { vectorizeLogo } from "@/lib/logoVectorize";

// Traces an uploaded logo into vector path data at upload time, for
// single-color-ink techniques whose print-ready outline file needs the logo
// as true curves rather than an embedded raster. Runs server-side (potrace/
// sharp are Node-only) — called from the product builder right after a
// logo is picked, so the traced result travels with the rest of the
// personalization data into the cart/order.
export async function POST(request: NextRequest) {
  const { logoDataUrl } = (await request.json()) as { logoDataUrl?: string };
  if (!logoDataUrl) {
    return NextResponse.json({ error: "logoDataUrl is required" }, { status: 400 });
  }
  const match = /^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/.exec(logoDataUrl);
  if (!match) {
    return NextResponse.json({ error: "logoDataUrl must be a base64 data URL" }, { status: 400 });
  }
  try {
    const buffer = Buffer.from(match[1], "base64");
    const vector = await vectorizeLogo(buffer);
    return NextResponse.json(vector);
  } catch (err) {
    console.error("vectorize-logo error", err);
    return NextResponse.json({ error: "Could not vectorize this image" }, { status: 500 });
  }
}
