import { redirect } from "next/navigation";
import { getSessionProfile, createClient } from "@/lib/supabase/server";

export default async function SupplierOverview() {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  const supabase = await createClient();

  const { data: supplier } = await supabase
    .from("suppliers")
    .select("*")
    .eq("profile_id", session.user.id)
    .maybeSingle();
  if (!supplier) redirect("/login");

  const [{ count: approvedCount }, { count: pendingCount }] = await Promise.all([
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("supplier_id", supplier.id)
      .eq("status", "approved"),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("supplier_id", supplier.id)
      .eq("status", "pending"),
  ]);

  const stats = [
    { label: "Approved products", value: approvedCount ?? 0 },
    { label: "Awaiting approval", value: pendingCount ?? 0 },
    { label: "Since", value: supplier.since_year ?? "—" },
  ];

  return (
    <div>
      <h1 className="font-serif text-3xl mb-1">Overview</h1>
      <p className="text-muted mb-8">Welcome back, {supplier.business_name}.</p>
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
