import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import {
  OrderReceiptDocument,
  type ImageAsset,
  type ReceiptData,
  type ReceiptItem,
} from "@/lib/pdf/OrderReceiptDocument";

// react-pdf's own URL-based image loading silently drops the image (and
// collapses its layout space) on any fetch hiccup, with no fallback. Fetch
// and validate each image ourselves first so a missing/slow logo or product
// photo degrades to the placeholder box instead of breaking the PDF.
async function fetchImageAsset(url: string | null | undefined): Promise<ImageAsset | null> {
  if (!url) return null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    const format = contentType.includes("jpeg") || contentType.includes("jpg") ? "jpg" : "png";
    if (!contentType.includes("png") && !contentType.includes("jpeg") && !contentType.includes("jpg")) return null;
    const data = Buffer.from(await res.arrayBuffer());
    return { data, format };
  } catch {
    return null;
  }
}

type Personalization = {
  names?: string;
  date?: string;
  monogram?: string;
  technique?: string;
  renderUrl?: string;
  snapshotUrl?: string;
  inkColorHex?: string;
  inkPantoneCode?: string;
};

function personalizationSummary(p: Personalization | null): string | null {
  if (!p) return null;
  const ink = p.inkColorHex
    ? `Ink ${p.inkColorHex.toUpperCase()}${p.inkPantoneCode ? ` (${p.inkPantoneCode} approx.)` : ""}`
    : null;
  const parts = [p.names, p.date, p.technique, ink].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function formatDeliveryRange(from: Date, to: Date): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const sameYear = from.getFullYear() === to.getFullYear();
  const fromStr = from.toLocaleDateString(undefined, opts);
  const toStr = to.toLocaleDateString(undefined, { ...opts, year: "numeric" });
  if (from.getTime() === to.getTime()) return toStr;
  return sameYear ? `${fromStr} – ${toStr}` : `${from.toLocaleDateString(undefined, { ...opts, year: "numeric" })} – ${toStr}`;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // RLS on `orders`/`order_items` already restricts this to the order's own
  // customer, its planner, an involved supplier, or backoffice/admin — no
  // extra access check needed beyond letting the query run as the caller.
  const { data: order, error } = await supabase
    .from("orders")
    .select(
      `*,
       planner:planners ( business_name, tagline, logo_url, accent_color ),
       items:order_items (
         *,
         product:products ( name, lead_time_days_min, lead_time_days_max, images:product_images ( url, sort_order ) )
       )`
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !order || !order.planner) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const [plannerLogo, itemThumbnails] = await Promise.all([
    fetchImageAsset(order.planner.logo_url),
    Promise.all(
      (order.items ?? []).map((item) => {
        const p = (item.personalization ?? null) as Personalization | null;
        const productImages = (item.product?.images ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);
        return fetchImageAsset(p?.snapshotUrl ?? p?.renderUrl ?? productImages[0]?.url ?? null);
      })
    ),
  ]);

  const items: ReceiptItem[] = (order.items ?? []).map((item, i) => {
    const p = (item.personalization ?? null) as Personalization | null;
    return {
      productName: item.product?.name ?? "Product",
      variantLabel: item.variant_label,
      thumbnail: itemThumbnails[i],
      quantity: item.quantity,
      unitPrice: item.unit_price,
      lineTotal: item.unit_price * item.quantity,
      personalizationSummary: personalizationSummary(p),
    };
  });

  const createdAt = new Date(order.created_at);
  const leadMins = (order.items ?? []).map((i) => i.product?.lead_time_days_min ?? 0);
  const leadMaxs = (order.items ?? []).map((i) => i.product?.lead_time_days_max ?? 0);
  const deliveryEstimate =
    leadMins.length > 0
      ? formatDeliveryRange(
          new Date(createdAt.getTime() + Math.max(...leadMins) * 86400000),
          new Date(createdAt.getTime() + Math.max(...leadMaxs) * 86400000)
        )
      : null;

  const address = order.shipping_address as {
    address: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };

  const data: ReceiptData = {
    orderId: order.id,
    createdAt: order.created_at,
    customerName: order.customer_name,
    customerEmail: order.customer_email,
    shippingAddress: address,
    planner: {
      businessName: order.planner.business_name,
      tagline: order.planner.tagline,
      logo: plannerLogo,
      accentColor: order.planner.accent_color,
    },
    items,
    subtotal: order.subtotal,
    personalizationFee: order.personalization_fee,
    sampleFee: order.sample_fee,
    shippingFee: order.shipping_fee,
    tax: order.tax,
    total: order.total,
    deliveryEstimate,
  };

  const pdfBuffer = await renderToBuffer(OrderReceiptDocument({ data }));

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="receipt-${order.id.slice(0, 8)}.pdf"`,
    },
  });
}
