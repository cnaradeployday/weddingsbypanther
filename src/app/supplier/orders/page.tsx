import { redirect } from "next/navigation";
import { getSessionProfile, createClient } from "@/lib/supabase/server";
import { OrderStatusSelect } from "@/components/OrderStatusSelect";

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
          `id, quantity, unit_price, personalization,
           product:products ( name ),
           order:orders ( id, customer_name, status, created_at )`
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
        <div className="rounded-xl border border-line bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-5 py-3 font-medium">Product</th>
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Qty</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Placed</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-4 font-medium">{item.product?.name}</td>
                  <td className="px-5 py-4 text-muted">{item.order?.customer_name}</td>
                  <td className="px-5 py-4">{item.quantity}</td>
                  <td className="px-5 py-4">
                    {item.order && <OrderStatusSelect orderId={item.order.id} status={item.order.status} />}
                  </td>
                  <td className="px-5 py-4 text-muted">
                    {item.order?.created_at ? new Date(item.order.created_at).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
