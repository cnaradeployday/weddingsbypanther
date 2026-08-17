import { redirect } from "next/navigation";
import { getSessionProfile, createClient } from "@/lib/supabase/server";
import { formatUSD } from "@/lib/format";

export default async function SupplierPayoutsPage() {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  const supabase = await createClient();

  const { data: supplier } = await supabase
    .from("suppliers")
    .select("id")
    .eq("profile_id", session.user.id)
    .maybeSingle();
  if (!supplier) redirect("/login");

  const { data: productIds } = await supabase
    .from("products")
    .select("id")
    .eq("supplier_id", supplier.id);
  const ids = (productIds ?? []).map((p) => p.id);

  const { data: items } = ids.length
    ? await supabase.from("order_items").select("quantity, unit_price").in("product_id", ids)
    : { data: [] };

  const grossOwed = (items ?? []).reduce((sum, i) => sum + i.quantity * i.unit_price, 0);

  return (
    <div>
      <h1 className="font-serif text-3xl mb-1">Payouts</h1>
      <p className="text-muted mb-8">Factory-price earnings from fulfilled line items.</p>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
        <div className="rounded-xl border border-line bg-white p-5">
          <p className="text-2xl font-serif">{formatUSD(grossOwed)}</p>
          <p className="text-xs text-muted uppercase tracking-wide mt-1">Total owed</p>
        </div>
        <div className="rounded-xl border border-line bg-white p-5">
          <p className="text-2xl font-serif">Net-30</p>
          <p className="text-xs text-muted uppercase tracking-wide mt-1">Payout terms</p>
        </div>
        <div className="rounded-xl border border-line bg-white p-5">
          <p className="text-2xl font-serif">Bank transfer</p>
          <p className="text-xs text-muted uppercase tracking-wide mt-1">Method on file</p>
        </div>
      </div>
      <p className="text-sm text-muted">
        Payout automation isn&apos;t wired up yet — this is a running total of what&apos;s owed based on
        fulfilled order line items.
      </p>
    </div>
  );
}
