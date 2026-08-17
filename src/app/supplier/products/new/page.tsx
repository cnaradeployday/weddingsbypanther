import { redirect } from "next/navigation";
import { getSessionProfile, createClient } from "@/lib/supabase/server";
import { SupplierProductForm } from "@/components/SupplierProductForm";

export default async function NewSupplierProductPage() {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  const supabase = await createClient();

  const { data: supplier } = await supabase
    .from("suppliers")
    .select("id")
    .eq("profile_id", session.user.id)
    .maybeSingle();
  if (!supplier) redirect("/login");

  const { data: categories } = await supabase.from("categories").select("id, name").order("sort_order");

  return (
    <div>
      <h1 className="font-serif text-3xl mb-1">Add product</h1>
      <p className="text-muted mb-8">Submit a new product for admin approval.</p>
      <SupplierProductForm supplierId={supplier.id} categories={categories ?? []} />
    </div>
  );
}
