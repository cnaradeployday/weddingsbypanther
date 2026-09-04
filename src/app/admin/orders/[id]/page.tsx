import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getSessionProfile, createClient } from "@/lib/supabase/server";
import { getBackofficePermissions } from "@/lib/permissions";
import { formatUSD } from "@/lib/format";
import { OrderStatusSelect } from "@/components/OrderStatusSelect";

type Personalization = {
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
                    {p.names && (
                      <p>
                        <span className="text-muted">Text:</span> {p.names}
                      </p>
                    )}
                    {p.date && (
                      <p>
                        <span className="text-muted">Date:</span> {p.date}
                      </p>
                    )}
                    {p.monogram && (
                      <p>
                        <span className="text-muted">Monogram:</span> {p.monogram}
                      </p>
                    )}
                    {p.technique && (
                      <p>
                        <span className="text-muted">Technique:</span> {p.technique}
                      </p>
                    )}
                    {p.sizeScale && p.sizeScale !== 1 && (
                      <p>
                        <span className="text-muted">Text size:</span> {Math.round(p.sizeScale * 100)}%
                      </p>
                    )}
                    {p.hasLogo && (
                      <p>
                        <span className="text-muted">Logo:</span> Customer uploaded a custom logo
                      </p>
                    )}
                    {p.inkColorHex && (
                      <p className="flex items-center gap-1.5">
                        <span className="text-muted">Ink color:</span>
                        <span
                          className="inline-block h-3 w-3 rounded-full border border-line shrink-0"
                          style={{ backgroundColor: p.inkColorHex }}
                        />
                        {p.inkColorHex.toUpperCase()}
                        {p.inkPantoneCode && ` · ${p.inkPantoneCode} (approx.)`}
                      </p>
                    )}
                    {(p.renderUrl || p.renderContextUrl || p.snapshotUrl) && (
                      <div className="pt-2">
                        <p className="text-xs uppercase tracking-wide text-muted mb-2">
                          {p.renderUrl ? "AI render" : "Configuration snapshot"}
                        </p>
                        <div className="flex gap-3">
                          {(p.renderUrl ?? p.snapshotUrl) && (
                            <a href={p.renderUrl ?? p.snapshotUrl} target="_blank" rel="noreferrer" className="relative h-24 w-24 rounded-lg overflow-hidden border border-line bg-white shrink-0">
                              <Image src={p.renderUrl ?? p.snapshotUrl!} alt="Configured product" fill className="object-contain" unoptimized />
                            </a>
                          )}
                          {p.renderContextUrl && (
                            <a href={p.renderContextUrl} target="_blank" rel="noreferrer" className="relative h-24 w-24 rounded-lg overflow-hidden border border-line bg-white shrink-0">
                              <Image src={p.renderContextUrl} alt="Wedding context render" fill className="object-contain" unoptimized />
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                    {(p.names?.trim() || p.date?.trim() || p.monogram?.trim() || p.logoVector?.ds?.length) && (
                      <div className="pt-1 flex gap-2">
                        <a
                          href={`/api/order-items/${item.id}/print-file`}
                          className="inline-block rounded-full border border-terracotta px-4 py-2 text-xs font-medium text-terracotta hover:bg-terracotta hover:text-white transition"
                        >
                          Download print file (SVG, outlined)
                        </a>
                        <a
                          href={`/api/order-items/${item.id}/print-file?format=pdf`}
                          className="inline-block rounded-full border border-terracotta px-4 py-2 text-xs font-medium text-terracotta hover:bg-terracotta hover:text-white transition"
                        >
                          Download PDF (outlined)
                        </a>
                      </div>
                    )}
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
