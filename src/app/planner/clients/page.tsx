import { redirect } from "next/navigation";
import { getSessionProfile, createClient } from "@/lib/supabase/server";
import { formatUSD } from "@/lib/format";

export default async function PlannerClientsPage() {
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
    .select("customer_name, customer_email, total, status, created_at")
    .eq("planner_id", planner.id)
    .order("created_at", { ascending: false });

  const byEmail = new Map<
    string,
    { name: string; email: string; orders: number; total: number; lastOrder: string }
  >();

  for (const o of orders ?? []) {
    const existing = byEmail.get(o.customer_email);
    if (existing) {
      existing.orders += 1;
      existing.total += o.total;
    } else {
      byEmail.set(o.customer_email, {
        name: o.customer_name,
        email: o.customer_email,
        orders: 1,
        total: o.total,
        lastOrder: o.created_at,
      });
    }
  }

  const clients = Array.from(byEmail.values()).sort(
    (a, b) => new Date(b.lastOrder).getTime() - new Date(a.lastOrder).getTime()
  );

  return (
    <div>
      <h1 className="font-serif text-3xl mb-1">Clients</h1>
      <p className="text-muted mb-8">
        {clients.length} couples who&apos;ve ordered through your storefront
      </p>

      {clients.length === 0 ? (
        <p className="text-muted">
          No clients yet — this list fills in automatically as orders come through checkout.
        </p>
      ) : (
        <div className="rounded-xl border border-line bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-5 py-3 font-medium">Client</th>
                <th className="px-5 py-3 font-medium">Orders</th>
                <th className="px-5 py-3 font-medium">Total spent</th>
                <th className="px-5 py-3 font-medium">Last order</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.email} className="border-b border-line last:border-0">
                  <td className="px-5 py-4">
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-muted">{c.email}</p>
                  </td>
                  <td className="px-5 py-4">{c.orders}</td>
                  <td className="px-5 py-4 font-medium">{formatUSD(c.total)}</td>
                  <td className="px-5 py-4 text-muted">
                    {new Date(c.lastOrder).toLocaleDateString()}
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
