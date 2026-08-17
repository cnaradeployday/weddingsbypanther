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

export default async function AdminProductsPage() {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  const supabase = await createClient();

  const { data: products } = await supabase
    .from("products")
    .select("*, category:categories(name), supplier:suppliers(business_name)")
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-3xl mb-1">Products</h1>
          <p className="text-muted">{products?.length ?? 0} products across all suppliers</p>
        </div>
        <Link
          href="/admin/products/new"
          className="px-5 py-2.5 rounded-full bg-sage text-cream-light text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Add product
        </Link>
      </div>

      <div className="rounded-xl border border-line bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3 font-medium">Product</th>
              <th className="px-5 py-3 font-medium">Supplier</th>
              <th className="px-5 py-3 font-medium">Category</th>
              <th className="px-5 py-3 font-medium">Factory price</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {(products ?? []).map((p) => (
              <tr key={p.id} className="border-b border-line last:border-0">
                <td className="px-5 py-4">
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-muted">{p.sku}</p>
                </td>
                <td className="px-5 py-4 text-muted">{p.supplier?.business_name}</td>
                <td className="px-5 py-4 text-muted">{p.category?.name}</td>
                <td className="px-5 py-4">{formatUSD(p.factory_price)}</td>
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
    </div>
  );
}
