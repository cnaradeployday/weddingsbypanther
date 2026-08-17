import { redirect } from "next/navigation";
import { getSessionProfile, createClient } from "@/lib/supabase/server";
import { ApprovalQueue, type PendingProduct } from "@/components/ApprovalQueue";
import { getBackofficePermissions } from "@/lib/permissions";

export default async function AdminApprovalsPage() {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  const supabase = await createClient();
  const perms = await getBackofficePermissions(supabase, session.profile);

  const { data } = await supabase
    .from("products")
    .select(
      `*, category:categories(name), supplier:suppliers(business_name),
       images:product_images(url, sort_order), techniques:product_print_techniques(technique)`
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  const products: PendingProduct[] = (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    sku: p.sku,
    factoryPrice: p.factory_price,
    minOrder: p.min_order,
    leadTimeMin: p.lead_time_days_min,
    leadTimeMax: p.lead_time_days_max,
    categoryName: p.category?.name ?? "",
    supplierName: p.supplier?.business_name ?? "",
    images: (p.images ?? []).slice().sort((a, b) => a.sort_order - b.sort_order).map((i) => i.url),
    techniques: (p.techniques ?? []).map((t) => t.technique),
  }));

  return (
    <div>
      <h1 className="font-serif text-3xl mb-1">Approval queue</h1>
      <p className="text-muted mb-8">{products.length} products waiting for review</p>
      <ApprovalQueue products={products} canWrite={perms.approvals.write} />
    </div>
  );
}
