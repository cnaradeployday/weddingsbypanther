import { redirect } from "next/navigation";
import Image from "next/image";
import { getSessionProfile, createClient } from "@/lib/supabase/server";
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

function hasOutlinableText(p: AreaPersonalization | null | undefined): boolean {
  return Boolean(p?.names?.trim() || p?.date?.trim() || p?.monogram?.trim() || p?.logoVector?.ds?.length);
}

// One print area's fulfillment detail (design + preview + print-file
// downloads) — used for the primary area and, below it, each additional
// area the shopper added, each with its own independent design.
function SupplierAreaDetail({ area, itemId, zoneId }: { area: AreaPersonalization; itemId: string; zoneId?: string }) {
  const previewUrl = area.snapshotUrl ?? area.renderUrl;
  const zoneQuery = zoneId ? `zone=${zoneId}` : "";
  const withZone = (extra?: string) => [zoneQuery, extra].filter(Boolean).join("&");
  return (
    <div className="rounded-lg bg-cream p-4 text-sm flex flex-wrap gap-4">
      <div className="space-y-1 min-w-[180px]">
        <p className="text-xs uppercase tracking-wide text-muted mb-1">
          {area.label || "Personalization"}
          {area.extraPrice ? ` (+${formatUSD(area.extraPrice)})` : ""}
        </p>
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
      </div>
      {(previewUrl || area.renderContextUrl) && (
        <div>
          <p className="text-xs uppercase tracking-wide text-muted mb-2">
            {area.snapshotUrl && !area.renderUrl ? "Configuration snapshot" : "AI render"}
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
      {hasOutlinableText(area) && (
        <div className="flex items-end gap-2">
          <a
            href={`/api/order-items/${itemId}/print-file${zoneQuery ? `?${withZone()}` : ""}`}
            className="rounded-full border border-terracotta px-4 py-2 text-xs font-medium text-terracotta hover:bg-terracotta hover:text-white transition"
          >
            Download print file (SVG, outlined)
          </a>
          <a
            href={`/api/order-items/${itemId}/print-file?${withZone("format=pdf")}`}
            className="rounded-full border border-terracotta px-4 py-2 text-xs font-medium text-terracotta hover:bg-terracotta hover:text-white transition"
          >
            Download PDF (outlined)
          </a>
        </div>
      )}
    </div>
  );
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
                  <div className="space-y-3">
                    <SupplierAreaDetail area={p} itemId={item.id} zoneId={p.zoneId} />
                    {(p.additionalAreas ?? []).map((area, i) => (
                      <SupplierAreaDetail key={area.zoneId ?? i} area={area} itemId={item.id} zoneId={area.zoneId} />
                    ))}
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
