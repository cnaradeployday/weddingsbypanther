import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getSessionProfile, createClient } from "@/lib/supabase/server";
import { getBackofficePermissions } from "@/lib/permissions";
import { formatUSD } from "@/lib/format";
import { OrderStatusSelect } from "@/components/OrderStatusSelect";

type AreaPersonalization = {
  zoneId?: string;
  label?: string;
  extraPrice?: number;
  names?: string;
  date?: string;
  monogram?: string;
  technique?: string;
  sizeScale?: number;
  positions?: Record<string, { x: number; y: number }>;
  hasLogo?: boolean;
  renderUrl?: string;
  renderContextUrl?: string;
  snapshotUrl?: string;
  inkColorHex?: string;
  inkPantoneCode?: string;
  logoVector?: { ds: string[] } | null;
};

type Personalization = AreaPersonalization & {
  additionalAreas?: AreaPersonalization[];
};

// One print area's personalization detail — used for the primary area and,
// underneath it, each additional one the shopper added, since each has its
// own independent design and its own print-ready outline export.
function AreaPersonalizationDetail({
  area,
  itemId,
  zoneId,
}: {
  area: AreaPersonalization;
  itemId: string;
  zoneId?: string;
}) {
  const zoneQuery = zoneId ? `zone=${zoneId}` : "";
  const withZone = (extra?: string) => [zoneQuery, extra].filter(Boolean).join("&");
  return (
    <div className="space-y-2">
      {area.label && (
        <p className="text-xs uppercase tracking-wide text-muted">
          {area.label}
          {area.extraPrice ? ` (+${formatUSD(area.extraPrice)})` : ""}
        </p>
      )}
      {area.names && (
        <p>
          <span className="text-muted">Text:</span> {area.names}
        </p>
      )}
      {area.date && (
        <p>
          <span className="text-muted">Date:</span> {area.date}
        </p>
      )}
      {area.monogram && (
        <p>
          <span className="text-muted">Monogram:</span> {area.monogram}
        </p>
      )}
      {area.technique && (
        <p>
          <span className="text-muted">Technique:</span> {area.technique}
        </p>
      )}
      {area.sizeScale && area.sizeScale !== 1 && (
        <p>
          <span className="text-muted">Text size:</span> {Math.round(area.sizeScale * 100)}%
        </p>
      )}
      {area.hasLogo && (
        <p>
          <span className="text-muted">Logo:</span> Customer uploaded a custom logo
        </p>
      )}
      {area.inkColorHex && (
        <p className="flex items-center gap-1.5">
          <span className="text-muted">Ink color:</span>
          <span
            className="inline-block h-3 w-3 rounded-full border border-line shrink-0"
            style={{ backgroundColor: area.inkColorHex }}
          />
          {area.inkColorHex.toUpperCase()}
          {area.inkPantoneCode && ` · ${area.inkPantoneCode} (approx.)`}
        </p>
      )}
      {(area.renderUrl || area.renderContextUrl || area.snapshotUrl) && (
        <div className="pt-2">
          <p className="text-xs uppercase tracking-wide text-muted mb-2">
            {area.renderUrl ? "AI render" : "Configuration snapshot"}
          </p>
          <div className="flex gap-3">
            {(area.renderUrl ?? area.snapshotUrl) && (
              <a
                href={area.renderUrl ?? area.snapshotUrl}
                target="_blank"
                rel="noreferrer"
                className="relative h-24 w-24 rounded-lg overflow-hidden border border-line bg-white shrink-0"
              >
                <Image src={area.renderUrl ?? area.snapshotUrl!} alt="Configured product" fill className="object-contain" unoptimized />
              </a>
            )}
            {area.renderContextUrl && (
              <a
                href={area.renderContextUrl}
                target="_blank"
                rel="noreferrer"
                className="relative h-24 w-24 rounded-lg overflow-hidden border border-line bg-white shrink-0"
              >
                <Image src={area.renderContextUrl} alt="Wedding context render" fill className="object-contain" unoptimized />
              </a>
            )}
          </div>
        </div>
      )}
      {(area.names?.trim() || area.date?.trim() || area.monogram?.trim() || area.logoVector?.ds?.length) && (
        <div className="pt-1 flex gap-2">
          <a
            href={`/api/order-items/${itemId}/print-file${zoneQuery ? `?${withZone()}` : ""}`}
            className="inline-block rounded-full border border-terracotta px-4 py-2 text-xs font-medium text-terracotta hover:bg-terracotta hover:text-white transition"
          >
            Download print file (SVG, outlined)
          </a>
          <a
            href={`/api/order-items/${itemId}/print-file?${withZone("format=pdf")}`}
            className="inline-block rounded-full border border-terracotta px-4 py-2 text-xs font-medium text-terracotta hover:bg-terracotta hover:text-white transition"
          >
            Download PDF (outlined)
          </a>
        </div>
      )}
    </div>
  );
}

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  const supabase = await createClient();
  const perms = await getBackofficePermissions(supabase, session.profile);

  const { data: order } = await supabase
    .from("orders")
    .select("*, planner:planners(business_name, slug)")
    .eq("id", id)
    .maybeSingle();

  if (!order) notFound();

  const { data: items } = await supabase
    .from("order_items")
    .select("*, product:products(name, slug)")
    .eq("order_id", id);

  const shipping = (order.shipping_address ?? {}) as Record<string, string>;

  return (
    <div>
      <p className="text-sm text-muted mb-2">
        <Link href="/admin/orders">Orders</Link> / Order detail
      </p>
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-3xl mb-1">{order.customer_name}</h1>
          <p className="text-muted">
            {order.planner?.business_name ?? "—"} · Placed{" "}
            {new Date(order.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
          </p>
        </div>
        <OrderStatusSelect orderId={order.id} status={order.status} canWrite={perms.orders.write} />
      </div>

      <div className="grid md:grid-cols-[1fr_320px] gap-8">
        <div className="space-y-4">
          {(items ?? []).map((item) => {
            const p = (item.personalization ?? null) as Personalization | null;
            return (
              <div key={item.id} className="rounded-xl border border-line bg-white p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <p className="font-medium">
                      {item.product?.name ?? "Deleted product"}
                      {item.variant_label ? ` — ${item.variant_label}` : ""}
                      {item.is_sample && (
                        <span className="ml-2 text-[10px] uppercase tracking-wide text-terracotta align-middle">
                          Sample
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-muted">
                      {item.quantity} × {formatUSD(item.unit_price)}
                    </p>
                  </div>
                  <p className="font-medium">{formatUSD(item.unit_price * item.quantity)}</p>
                </div>

                {p && (
                  <div className="rounded-lg bg-cream p-4 text-sm space-y-2">
                    <p className="text-xs uppercase tracking-wide text-muted">Personalization</p>
                    <AreaPersonalizationDetail area={p} itemId={item.id} zoneId={p.zoneId} />
                    {(p.additionalAreas ?? []).map((area, i) => (
                      <div key={area.zoneId ?? i} className="pt-3 mt-3 border-t border-line/70">
                        <AreaPersonalizationDetail area={area} itemId={item.id} zoneId={area.zoneId} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {(!items || items.length === 0) && <p className="text-muted">No line items on this order.</p>}
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-line bg-white p-5">
            <p className="text-xs uppercase tracking-wide text-muted mb-3">Customer</p>
            <p className="font-medium">{order.customer_name}</p>
            <p className="text-sm text-muted">{order.customer_email}</p>
            {shipping.phone && <p className="text-sm text-muted mt-1">{shipping.phone}</p>}
          </div>

          <div className="rounded-xl border border-line bg-white p-5">
            <p className="text-xs uppercase tracking-wide text-muted mb-3">Shipping address</p>
            <p className="text-sm">
              {shipping.address}
              <br />
              {shipping.city}, {shipping.state} {shipping.zip}
              <br />
              {shipping.country}
            </p>
          </div>

          <div className="rounded-xl border border-line bg-white p-5 space-y-2 text-sm">
            <p className="text-xs uppercase tracking-wide text-muted mb-1">Payment</p>
            <div className="flex justify-between">
              <span className="text-muted">Subtotal</span>
              <span>{formatUSD(order.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Personalization</span>
              <span>{formatUSD(order.personalization_fee)}</span>
            </div>
            {order.sample_fee > 0 && (
              <div className="flex justify-between">
                <span className="text-muted">Sample setup</span>
                <span>{formatUSD(order.sample_fee)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted">Shipping</span>
              <span>{formatUSD(order.shipping_fee)}</span>
            </div>
            <div className="flex justify-between border-t border-line pt-2 font-medium">
              <span>Total</span>
              <span>{formatUSD(order.total)}</span>
            </div>
            <p className="text-xs text-muted pt-1 capitalize">{order.payment_status.replace(/_/g, " ")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
