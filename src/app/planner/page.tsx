import { redirect } from "next/navigation";
import { getSessionProfile, createClient } from "@/lib/supabase/server";
import { formatUSD } from "@/lib/format";

export default async function PlannerOverview() {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  const supabase = await createClient();

  const { data: planner } = await supabase
    .from("planners")
    .select("*")
    .eq("profile_id", session.user.id)
    .maybeSingle();
  if (!planner) redirect("/login");

  const [{ count: orderCount }, { data: orders }, { count: enabledCount }, { count: proposalCount }] =
    await Promise.all([
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("planner_id", planner.id),
      supabase.from("orders").select("total").eq("planner_id", planner.id),
      supabase
        .from("planner_products")
        .select("id", { count: "exact", head: true })
        .eq("planner_id", planner.id)
        .eq("enabled", true),
      supabase.from("proposals").select("id", { count: "exact", head: true }).eq("planner_id", planner.id),
    ]);

  const revenue = (orders ?? []).reduce((sum, o) => sum + o.total, 0);

  const stats = [
    { label: "Orders", value: orderCount ?? 0 },
    { label: "Revenue", value: formatUSD(revenue) },
    { label: "Products live", value: enabledCount ?? 0 },
    { label: "Proposals sent", value: proposalCount ?? 0 },
  ];

  return (
    <div>
      <h1 className="font-serif text-3xl mb-1">Overview</h1>
      <p className="text-muted mb-8">Welcome back, {planner.business_name}.</p>

      {planner.status === "pending" && (
        <div className="rounded-xl border border-gold bg-gold/10 p-4 text-sm mb-8">
          Your storefront is awaiting approval from the Bespoke team — it won&apos;t be visible
          to customers until then. You can keep setting things up in the meantime.
        </div>
      )}
      {planner.status === "suspended" && (
        <div className="rounded-xl border border-terracotta bg-terracotta/10 p-4 text-sm mb-8">
          Your storefront has been suspended and isn&apos;t visible to customers. Contact
          Bespoke support if you think this is a mistake.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
