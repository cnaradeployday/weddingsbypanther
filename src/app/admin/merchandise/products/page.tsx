import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionProfile, createClient } from "@/lib/supabase/server";
import { getBackofficePermissions } from "@/lib/permissions";
import { ProductsTable } from "@/components/ProductsTable";

// The promotional-merchandise sibling of /admin/products — same table, same
// edit route, just filtered to products whose category belongs to the
// merchandise vertical, so the two catalogs never mix in one list.
export default async function AdminMerchandiseProductsPage() {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  const supabase = await createClient();
  const perms = await getBackofficePermissions(supabase, session.profile);

  const { data: products } = await supabase
    .from("products")
    .select("*, category:categories!inner(name, business_type), supplier:suppliers(business_name)")
    .eq("category.business_type", "merchandise")
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-3xl mb-1">Merchandise products</h1>
          <p className="text-muted">{products?.length ?? 0} promotional-merchandise products</p>
        </div>
        {perms.products.write && (
          <Link
            href="/admin/merchandise/products/new"
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
