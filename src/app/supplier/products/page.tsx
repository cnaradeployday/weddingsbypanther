import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionProfile, createClient } from "@/lib/supabase/server";
import { formatUSD } from "@/lib/format";

const STATUS_STYLE: Record<string, string> = {
  approved: "bg-sage/15 text-sage",
  pending: "bg-gold/20 text-dark",
  rejected: "bg-terracotta/15 text-terracotta-dark",
  draft: "bg-line text-muted",
};

export default async function SupplierProductsPage() {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  const supabase = await createClient();

  const { data: supplier } = await supabase
    .from("suppliers")
    .select("id")
    .eq("profile_id", session.user.id)
    .maybeSingle();
  if (!supplier) redirect("/login");

  const { data: products } = await supabase
    .from("products")
    .select("*, category:categories(name)")
    .eq("supplier_id", supplier.id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-3xl mb-1">My products</h1>
          <p className="text-muted">{products?.length ?? 0} products submitted</p>
        </div>
        <Link
          href="/supplier/products/new"
          className="px-5 py-2.5 rounded-full bg-terracotta text-cream-light text-sm font-medium hover:bg-terracotta-dark transition-colors"
        >
          Add product
        </Link>
      </div>

      {!products || products.length === 0 ? (
        <p className="text-muted">No products yet — add your first one.</p>
      ) : (
        <div className="rounded-xl border border-line bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-5 py-3 font-medium">Product</th>
                <th className="px-5 py-3 font-medium">Category</th>
                <th className="px-5 py-3 font-medium">Factory price</th>
                <th className="px-5 py-3 font-medium">Min order</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-4">
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-muted">{p.sku}</p>
                  </td>
                  <td className="px-5 py-4 text-muted">{p.category?.name}</td>
                  <td className="px-5 py-4">{formatUSD(p.factory_price)}</td>
                  <td className="px-5 py-4">{p.min_order}</td>
                  <td className="px-5 py-4">
                    <span className={`text-xs px-2.5 py-1 rounded-full capitalize ${STATUS_STYLE[p.status]}`}>
                      {p.status}
                    </span>
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
