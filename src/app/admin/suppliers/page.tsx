import { redirect } from "next/navigation";
import { getSessionProfile, createClient } from "@/lib/supabase/server";
import { VettingStatusControl } from "@/components/VettingStatusControl";

export default async function AdminSuppliersPage() {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  const supabase = await createClient();

  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("*, products:products(count)")
    .order("business_name");

  return (
    <div>
      <h1 className="font-serif text-3xl mb-1">Suppliers</h1>
      <p className="text-muted mb-8">{suppliers?.length ?? 0} suppliers on the marketplace</p>
      <div className="rounded-xl border border-line bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3 font-medium">Company</th>
              <th className="px-5 py-3 font-medium">Since</th>
              <th className="px-5 py-3 font-medium">Products</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {(suppliers ?? []).map((s) => (
              <tr key={s.id} className="border-b border-line last:border-0">
                <td className="px-5 py-4 font-medium">{s.business_name}</td>
                <td className="px-5 py-4 text-muted">{s.since_year ?? "—"}</td>
                <td className="px-5 py-4">{s.products?.[0]?.count ?? 0}</td>
                <td className="px-5 py-4">
                  <VettingStatusControl table="suppliers" id={s.id} status={s.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
