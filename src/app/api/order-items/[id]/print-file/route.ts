import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { techniqueInkColor } from "@/lib/printTechniqueColors";
import { buildOutlineArtworkSvg, type LogoVector, type OutlineLayoutParams } from "@/lib/personalizationOutline";
import { buildOutlinePdfDocument } from "@/lib/personalizationOutlinePdf";
import type { ElemKey, Corner } from "@/lib/personalizationComposite";

type Personalization = {
  names?: string;
  date?: string;
  monogram?: string;
  frame?: string;
  textFont?: string;
  technique?: string;
  inkColorHex?: string;
  logoVector?: LogoVector | null;
  elemScale?: Partial<Record<ElemKey, number>>;
  elemRotationOffset?: Partial<Record<ElemKey, number>>;
  positions?: Record<string, Corner>;
};

// Print shops need the names/date/frame as real vector outlines, not the
// photo mockup a couple sees in the builder — this returns just that
// artwork, sized to the product's real print-area dimensions, as either a
// standalone SVG (default) or a true vector PDF (?format=pdf — some print/
// laser shops specifically want "curves in a PDF"). RLS on order_items
// already restricts this to the item's own supplier, its planner, the
// customer, or backoffice/admin (same trust boundary the receipt route
// relies on) — no extra check needed beyond letting the query run as the
// caller.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const format = request.nextUrl.searchParams.get("format") === "pdf" ? "pdf" : "svg";
  const supabase = await createClient();

  const { data: item, error } = await supabase
    .from("order_items")
    .select(`id, personalization, product:products ( zones:product_print_zones ( width_mm, height_mm, corners_pct ) )`)
    .eq("id", id)
    .maybeSingle();

  if (error || !item) {
    return NextResponse.json({ error: "Order item not found" }, { status: 404 });
  }

  const p = (item.personalization ?? null) as Personalization | null;
  if (!p || !(p.names?.trim() || p.date?.trim() || p.monogram?.trim() || p.logoVector?.ds?.length)) {
    return NextResponse.json({ error: "This item has no personalization to outline" }, { status: 400 });
  }

  const zone = item.product?.zones?.[0];
  const canvasW = zone?.width_mm ?? 60;
  const canvasH = zone?.height_mm ?? 30;
  const zoneCorners = (zone?.corners_pct as Corner[] | null) ?? undefined;

  const layoutParams: OutlineLayoutParams = {
    canvasW,
    canvasH,
    zoneCorners,
    positions: p.positions ?? {},
    names: p.names ?? "",
    date: p.date ?? "",
    monogram: p.monogram ?? "",
    frame: p.frame ?? "",
    textFont: p.textFont ?? "",
    inkColor: p.inkColorHex ?? techniqueInkColor(p.technique),
    logoVector: p.logoVector ?? null,
    fontScale: p.elemScale,
    rotations: p.elemRotationOffset,
  };

  if (format === "pdf") {
    const pdfBuffer = await renderToBuffer(await buildOutlinePdfDocument(layoutParams));
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="print-outline-${id.slice(0, 8)}.pdf"`,
      },
    });
  }

  const svg = await buildOutlineArtworkSvg(layoutParams);
  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Content-Disposition": `attachment; filename="print-outline-${id.slice(0, 8)}.svg"`,
    },
  });
}
