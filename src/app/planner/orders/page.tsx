import { redirect } from "next/navigation";
import { getSessionProfile, createClient } from "@/lib/supabase/server";
import { formatUSD } from "@/lib/format";
import { OrderStatusSelect } from "@/components/OrderStatusSelect";

export default async function PlannerOrdersPage() {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  const supabase = await createClient();

  const { data: planner } = await supabase
    .from("planners")
    .select("id")
    .eq("profile_id", session.user.id)
    .maybeSingle();
  if (!planner) redirect("/login");

  const { data: orders } = await supabase
    .from("orders")
    .select("*")
    .eq("planner_id", planner.id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="font-serif text-3xl mb-1">Orders</h1>
      <p className="text-muted mb-8">{orders?.length ?? 0} orders placed through your storefront</p>

      {!orders || orders.length === 0 ? (
        <p className="text-muted">No orders yet.</p>
      ) : (
        <div className="rounded-xl border border-line bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-4">
                    <p className="font-medium">{o.customer_name}</p>
                    <p className="text-xs text-muted">{o.customer_email}</p>
                  </td>
                  <td className="px-5 py-4 text-muted">
                    {new Date(o.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-4">
                    <OrderStatusSelect orderId={o.id} status={o.status} />
                  </td>
                  <td className="px-5 py-4 font-medium">{formatUSD(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
