import { redirect } from "next/navigation";
import Image from "next/image";
import { getSessionProfile, createClient } from "@/lib/supabase/server";
import { formatUSD } from "@/lib/format";
import { OrderStatusSelect } from "@/components/OrderStatusSelect";

type Personalization = {
  names?: string;
  date?: string;
  monogram?: string;
  technique?: string;
  sizeScale?: number;
  hasLogo?: boolean;
  renderUrl?: string;
  renderContextUrl?: string;
  snapshotUrl?: string;
};

function hasOutlinableText(p: Personalization | null): boolean {
  return Boolean(p?.names?.trim() || p?.date?.trim() || p?.monogram?.trim());
}

export default async function SupplierOrdersPage() {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  const supabase = await createClient();

  const { data: supplier } = await supabase
    .from("suppliers")
    .select("id")
    .eq("profile_id", session.user.id)
    .maybeSingle();
  if (!supplier) redirect("/login");

  const { data: productIds } = await supabase
    .from("products")
    .select("id")
    .eq("supplier_id", supplier.id);

  const ids = (productIds ?? []).map((p) => p.id);

  const { data: items } = ids.length
    ? await supabase
        .from("order_items")
        .select(
          `id, quantity, unit_price, variant_label, personalization, is_sample,
           product:products ( name ),
           order:orders ( id, customer_name, customer_email, status, created_at )`
        )
        .in("product_id", ids)
        .order("id", { ascending: false })
    : { data: [] };

  return (
    <div>
      <h1 className="font-serif text-3xl mb-1">Orders to fulfil</h1>
      <p className="text-muted mb-8">{items?.length ?? 0} line items across all storefronts</p>

      {!items || items.length === 0 ? (
        <p className="text-muted">No orders yet.</p>
      ) : (
        <div className="space-y-4">
          {items.map((item) => {
            const p = (item.personalization ?? null) as Personalization | null;
            const previewUrl = p?.snapshotUrl ?? p?.renderUrl;
            return (
              <div key={item.id} className="rounded-xl border border-line bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
                  <div>
                    <p className="font-medium">
                      {item.product?.name ?? "Deleted product"}
                      {item.variant_label ? ` — ${item.variant_label}` : ""}
                      {item.is_sample && (
                        <span className="ml-2 text-[10px] uppercase tracking-wide text-terracotta align-middle">
                          Sample — 1-off setup
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-muted">
                      {item.order?.customer_name} · {item.order?.customer_email}
                    </p>
                    <p className="text-sm text-muted">
                      {item.quantity} × {formatUSD(item.unit_price)} ·{" "}
                      {item.order?.created_at ? new Date(item.order.created_at).toLocaleDateString() : "—"}
                    </p>
                  </div>
                  {item.order && <OrderStatusSelect orderId={item.order.id} status={item.order.status} />}
                </div>

                {p && (
                  <div className="rounded-lg bg-cream p-4 text-sm flex flex-wrap gap-4">
                    <div className="space-y-1 min-w-[180px]">
                      <p className="text-xs uppercase tracking-wide text-muted mb-1">Personalization</p>
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
                    </div>
                    {(previewUrl || p.renderContextUrl) && (
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted mb-2">
                          {p.snapshotUrl && !p.renderUrl ? "Configuration snapshot" : "AI render"}
                        </p>
                        <div className="flex gap-3">
                          {previewUrl && (
                            <a
                              href={previewUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="relative h-24 w-24 rounded-lg overflow-hidden border border-line bg-white shrink-0"
                            >
                              <Image src={previewUrl} alt="Configured product" fill className="object-contain" unoptimized />
                            </a>
                          )}
                          {p.renderContextUrl && (
                            <a
                              href={p.renderContextUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="relative h-24 w-24 rounded-lg overflow-hidden border border-line bg-white shrink-0"
                            >
                              <Image src={p.renderContextUrl} alt="Wedding context render" fill className="object-contain" unoptimized />
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                    {hasOutlinableText(p) && (
                      <div className="flex items-end">
                        <a
                          href={`/api/order-items/${item.id}/print-file`}
                          className="rounded-full border border-terracotta px-4 py-2 text-xs font-medium text-terracotta hover:bg-terracotta hover:text-white transition"
                        >
                          Download print file (outlined)
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
