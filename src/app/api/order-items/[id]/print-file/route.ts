import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { techniqueInkColor } from "@/lib/printTechniqueColors";
import { buildOutlineArtworkSvg } from "@/lib/personalizationOutline";
import type { ElemKey, Corner } from "@/lib/personalizationComposite";

type Personalization = {
  names?: string;
  date?: string;
  monogram?: string;
  frame?: string;
  textFont?: string;
  technique?: string;
  elemScale?: Partial<Record<ElemKey, number>>;
  elemRotationOffset?: Partial<Record<ElemKey, number>>;
  positions?: Record<string, Corner>;
};

// Print shops need the names/date/frame as real vector outlines, not the
// photo mockup a couple sees in the builder — this returns just that
// artwork as a standalone SVG, sized to the product's real print-area
// dimensions. RLS on order_items already restricts this to the item's own
// supplier, its planner, the customer, or backoffice/admin (same trust
// boundary the receipt route relies on) — no extra check needed beyond
// letting the query run as the caller.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: item, error } = await supabase
    .from("order_items")
    .select(`id, personalization, product:products ( zones:product_print_zones ( width_mm, height_mm ) )`)
    .eq("id", id)
    .maybeSingle();

  if (error || !item) {
    return NextResponse.json({ error: "Order item not found" }, { status: 404 });
  }

  const p = (item.personalization ?? null) as Personalization | null;
  if (!p || !(p.names?.trim() || p.date?.trim() || p.monogram?.trim())) {
    return NextResponse.json({ error: "This item has no personalization to outline" }, { status: 400 });
  }

  const zone = item.product?.zones?.[0];
  const canvasW = zone?.width_mm ?? 60;
  const canvasH = zone?.height_mm ?? 30;

  const svg = await buildOutlineArtworkSvg({
    canvasW,
    canvasH,
    positions: p.positions ?? {},
    names: p.names ?? "",
    date: p.date ?? "",
    monogram: p.monogram ?? "",
    frame: p.frame ?? "",
    textFont: p.textFont ?? "",
    inkColor: techniqueInkColor(p.technique),
    fontScale: p.elemScale,
    rotations: p.elemRotationOffset,
  });

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Content-Disposition": `attachment; filename="print-outline-${id.slice(0, 8)}.svg"`,
    },
  });
}
