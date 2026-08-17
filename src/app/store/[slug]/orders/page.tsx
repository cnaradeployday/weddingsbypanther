import Image from "next/image";
import { getSessionProfile, createClient } from "@/lib/supabase/server";
import { formatUSD } from "@/lib/format";
import { CustomerLoginOtp } from "@/components/CustomerLoginOtp";

type Personalization = {
  names?: string;
  date?: string;
  monogram?: string;
  technique?: string;
  hasLogo?: boolean;
  renderUrl?: string;
  snapshotUrl?: string;
};

const STATUS_LABEL: Record<string, string> = {
  pending_proof: "Proof pending",
  in_production: "In production",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export default async function CustomerOrdersPage() {
  const session = await getSessionProfile();

  if (!session) {
    return (
      <div className="mx-auto max-w-xl px-6 py-20">
        <CustomerLoginOtp />
      </div>
    );
  }

  const supabase = await createClient();
  const { data: orders } = await supabase
    .from("orders")
    .select("*, items:order_items(*, product:products(name))")
    .eq("customer_id", session.user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-3xl px-6 py-14">
      <h1 className="font-serif text-3xl mb-1">Your orders</h1>
      <p className="text-muted mb-8">Signed in as {session.user.email}</p>

      {!orders || orders.length === 0 ? (
        <p className="text-muted">No orders yet under this email.</p>
      ) : (
        <div className="space-y-6">
          {orders.map((order) => (
            <div key={order.id} className="rounded-2xl border border-line bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div>
                  <p className="text-xs text-muted mb-1">
                    Placed {new Date(order.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
                  </p>
                  <p className="font-serif text-xl">{formatUSD(order.total)}</p>
                </div>
                <span className="text-xs uppercase tracking-wide bg-cream px-3 py-1.5 rounded-full">
                  {STATUS_LABEL[order.status] ?? order.status}
                </span>
              </div>

              <div className="space-y-3">
                {(order.items ?? []).map((item) => {
                  const p = (item.personalization ?? null) as Personalization | null;
                  const previewUrl = p?.snapshotUrl ?? p?.renderUrl;
                  return (
                    <div key={item.id} className="flex items-center gap-3 rounded-lg bg-cream p-3">
                      {previewUrl && (
                        <div className="relative h-14 w-14 rounded-md overflow-hidden border border-line bg-white shrink-0">
                          <Image src={previewUrl} alt="" fill className="object-contain" unoptimized />
                        </div>
                      )}
                      <div className="text-sm">
                        <p className="font-medium">
                          {item.product?.name ?? "Product"}
                          {item.variant_label ? ` — ${item.variant_label}` : ""}
                        </p>
                        <p className="text-muted">
                          {item.quantity} × {formatUSD(item.unit_price)}
                          {p?.names ? ` · ${p.names}` : ""}
                          {p?.date ? ` · ${p.date}` : ""}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
