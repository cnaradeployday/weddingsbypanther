import { redirect } from "next/navigation";
import { getSessionProfile, createClient } from "@/lib/supabase/server";
import { PlannerProductsTable, type PlannerProductRow } from "@/components/PlannerProductsTable";

export default async function PlannerProductsPage() {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  const supabase = await createClient();

  const { data: planner } = await supabase
    .from("planners")
    .select("*")
    .eq("profile_id", session.user.id)
    .maybeSingle();
  if (!planner) redirect("/login");

  const { data } = await supabase
    .from("planner_products")
    .select(
      `id, markup_pct, enabled,
       product:products (
         id, name, sku, factory_price,
         category:categories ( name ),
         supplier:suppliers ( business_name )
       )`
    )
    .eq("planner_id", planner.id);

  const rows: PlannerProductRow[] = (data ?? [])
    .filter((r) => r.product)
    .map((r) => ({
      id: r.id,
      productId: r.product!.id,
      name: r.product!.name,
      sku: r.product!.sku,
      categoryName: r.product!.category?.name ?? "",
      supplierName: r.product!.supplier?.business_name ?? "",
      factoryPrice: r.product!.factory_price,
      markupPct: r.markup_pct,
      enabled: r.enabled,
    }));

  return (
    <div>
      <h1 className="font-serif text-3xl mb-1">Product catalog</h1>
      <p className="text-muted mb-8">
        {rows.length} products available · {rows.filter((r) => r.enabled).length} enabled on your
        storefront
      </p>
      <PlannerProductsTable plannerId={planner.id} rows={rows} />
    </div>
  );
}
