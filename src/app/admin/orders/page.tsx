import { redirect } from "next/navigation";
import { getSessionProfile, createClient } from "@/lib/supabase/server";
import { formatUSD } from "@/lib/format";

export default async function AdminOrdersPage() {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  const supabase = await createClient();

  const { data: orders } = await supabase
    .from("orders")
    .select("*, planner:planners(business_name)")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="font-serif text-3xl mb-1">Orders</h1>
      <p className="text-muted mb-8">{orders?.length ?? 0} orders across the marketplace</p>
      <div className="rounded-xl border border-line bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3 font-medium">Customer</th>
              <th className="px-5 py-3 font-medium">Storefront</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Total</th>
              <th className="px-5 py-3 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {(orders ?? []).map((o) => (
              <tr key={o.id} className="border-b border-line last:border-0">
                <td className="px-5 py-4">
                  <p className="font-medium">{o.customer_name}</p>
                  <p className="text-xs text-muted">{o.customer_email}</p>
                </td>
                <td className="px-5 py-4 text-muted">{o.planner?.business_name ?? "—"}</td>
                <td className="px-5 py-4">
                  <span className="text-xs bg-cream px-2.5 py-1 rounded-full">{o.status}</span>
                </td>
                <td className="px-5 py-4 font-medium">{formatUSD(o.total)}</td>
                <td className="px-5 py-4 text-muted">{new Date(o.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
