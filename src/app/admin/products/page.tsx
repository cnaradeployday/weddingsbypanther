import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionProfile, createClient } from "@/lib/supabase/server";
import { getBackofficePermissions } from "@/lib/permissions";
import { ProductsTable } from "@/components/ProductsTable";

export default async function AdminProductsPage() {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  const supabase = await createClient();
  const perms = await getBackofficePermissions(supabase, session.profile);

  const { data: products } = await supabase
    .from("products")
    .select("*, category:categories!inner(name, business_type), supplier:suppliers(business_name)")
    .eq("category.business_type", "wedding")
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-3xl mb-1">Products</h1>
          <p className="text-muted">{products?.length ?? 0} wedding products across all suppliers</p>
        </div>
        {perms.products.write && (
          <Link
            href="/admin/products/new"
            className="px-5 py-2.5 rounded-full bg-sage text-cream-light text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Add product
          </Link>
        )}
      </div>

      <ProductsTable products={products ?? []} canWrite={perms.products.write} />
    </div>
  );
}
