import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { supabase } from "@/lib/supabase";
import { buildOutlineArtworkSvg, type LogoVector, type OutlineLayoutParams } from "@/lib/personalizationOutline";
import { buildOutlinePdfDocument } from "@/lib/personalizationOutlinePdf";
import type { Corner, ElemKey } from "@/lib/personalizationComposite";

export const runtime = "nodejs";

// Download-the-vector-file-right-now companion to
// /api/order-items/[id]/print-file — that route needs an existing order,
// which doesn't exist yet while a customer/planner is still in the Design
// step. Same output (a print-ready SVG or vector PDF of exactly what's on
// the canvas), built the same way (computeOutlineLayout, shared with the
// order-based route so the two can never disagree on layout), just fed
// from the live client state instead of a stored order_items row —
// mirrors personalization-snapshot's own "plain POST of the current
// design, no order required" pattern.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const productId: string | undefined = body?.productId;
  const zoneId: string | undefined = body?.zoneId;
  if (!productId) {
    return NextResponse.json({ error: "Missing productId." }, { status: 400 });
  }

  const { data: zones } = await supabase
    .from("product_print_zones")
    .select("id, width_mm, height_mm, corners_pct, sort_order")
    .eq("product_id", productId)
    .order("sort_order", { ascending: true });

  const zone = zoneId ? zones?.find((z) => z.id === zoneId) : zones?.[0];
  if (!zone) {
    return NextResponse.json({ error: "Print area not found." }, { status: 404 });
  }

  const format = body?.format === "pdf" ? "pdf" : "svg";
  const positions: Record<string, Corner> = body?.positions ?? {};
  const elemScale: Partial<Record<ElemKey, number>> = body?.elemScale ?? {};
  const elemRotationOffset: Partial<Record<ElemKey, number>> = body?.elemRotationOffset ?? {};
  const logoVector: LogoVector | null = body?.logoVector ?? null;

  if (
    !(
      (body?.names as string | undefined)?.trim() ||
      (body?.date as string | undefined)?.trim() ||
      (body?.monogram as string | undefined)?.trim() ||
      logoVector?.ds?.length
    )
  ) {
    return NextResponse.json({ error: "Nothing on this design to export yet." }, { status: 400 });
  }

  const layoutParams: OutlineLayoutParams = {
    canvasW: zone.width_mm ?? 60,
    canvasH: zone.height_mm ?? 30,
    zoneCorners: (zone.corners_pct as Corner[] | null) ?? undefined,
    positions,
    names: body?.names ?? "",
    date: body?.date ?? "",
    monogram: body?.monogram ?? "",
    frame: body?.frame ?? "",
    textFont: body?.textFont ?? "",
    inkColor: body?.inkColor ?? "#232323",
    namesColor: body?.namesColor,
    dateColor: body?.dateColor,
    monogramColor: body?.monogramColor,
    frameColor: body?.frameColor,
    logoVector,
    singleColorInk: !!body?.singleColorInk,
    fontScale: elemScale,
    rotations: elemRotationOffset,
  };

  if (format === "pdf") {
    const pdfBuffer = await renderToBuffer(await buildOutlinePdfDocument(layoutParams));
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="design-outline.pdf"`,
      },
    });
  }

  const svg = await buildOutlineArtworkSvg(layoutParams);
  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Content-Disposition": `attachment; filename="design-outline.svg"`,
    },
  });
}
