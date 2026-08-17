import { redirect } from "next/navigation";
import { getSessionProfile, createClient } from "@/lib/supabase/server";
import { formatUSD } from "@/lib/format";

export default async function AdminDashboard() {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  const supabase = await createClient();

  const [
    { count: plannerCount },
    { count: supplierCount },
    { count: productCount },
    { count: pendingCount },
    { data: orders },
  ] = await Promise.all([
    supabase.from("planners").select("id", { count: "exact", head: true }),
    supabase.from("suppliers").select("id", { count: "exact", head: true }),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("status", "approved"),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("orders").select("total"),
  ]);

  const gmv = (orders ?? []).reduce((sum, o) => sum + o.total, 0);

  const stats = [
    { label: "Planners", value: plannerCount ?? 0 },
    { label: "Suppliers", value: supplierCount ?? 0 },
    { label: "Approved products", value: productCount ?? 0 },
    { label: "Pending approval", value: pendingCount ?? 0 },
    { label: "Orders", value: orders?.length ?? 0 },
    { label: "GMV", value: formatUSD(gmv) },
  ];

  return (
    <div>
      <h1 className="font-serif text-3xl mb-1">Dashboard</h1>
      <p className="text-muted mb-8">Marketplace-wide snapshot.</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-line bg-white p-5">
            <p className="text-2xl font-serif">{s.value}</p>
            <p className="text-xs text-muted uppercase tracking-wide mt-1">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
