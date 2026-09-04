import { redirect } from "next/navigation";
import { getSessionProfile, createClient } from "@/lib/supabase/server";
import { AdminProductForm } from "@/components/AdminProductForm";

export default async function NewAdminProductPage() {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  const supabase = await createClient();

  const [{ data: suppliers }, { data: categories }, { data: techniques }, { data: otherProductRows }] =
    await Promise.all([
      supabase.from("suppliers").select("id, business_name").order("business_name"),
      supabase.from("categories").select("id, name").eq("business_type", "wedding").order("sort_order"),
      supabase.from("print_techniques").select("name").order("sort_order"),
      supabase
        .from("products")
        .select("id, name, category:categories!inner(business_type)")
        .eq("category.business_type", "wedding")
        .order("name"),
    ]);

  return (
    <div>
      <h1 className="font-serif text-3xl mb-1">Add product</h1>
      <p className="text-muted mb-8">Publish a product directly — no approval step needed.</p>
      <AdminProductForm
        suppliers={suppliers ?? []}
        categories={categories ?? []}
        techniqueOptions={(techniques ?? []).map((t) => t.name)}
        otherProducts={(otherProductRows ?? []).map((p) => ({ id: p.id, name: p.name }))}
      />
    </div>
  );
}
