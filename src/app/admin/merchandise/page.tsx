import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionProfile, createClient } from "@/lib/supabase/server";
import { VettingStatusControl } from "@/components/VettingStatusControl";
import { NewPlannerForm } from "@/components/NewPlannerForm";
import { getBackofficePermissions } from "@/lib/permissions";
import { STOREFRONT_ORIGIN } from "@/lib/businessType";

// Merchandise accounts are the exact same `planners` entity as wedding
// planners (same storefront/catalog/checkout machinery) — this is just a
// second, filtered view onto that table for the promotional-merchandise
// vertical, so it can have its own "new account" flow (business_type set
// to 'merchandise' from the start) without touching the wedding Planners
// page at all. Editing reuses the existing /admin/planners/[id]/edit route
// unchanged — it already works for any planner id regardless of type.
export default async function AdminMerchandisePage() {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  const supabase = await createClient();
  const perms = await getBackofficePermissions(supabase, session.profile);

  const { data: accounts } = await supabase
    .from("planners")
    .select("*")
    .eq("business_type", "merchandise")
    .order("business_name");

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-3xl mb-1">Merchandise</h1>
          <p className="text-muted">{accounts?.length ?? 0} promotional-merchandise storefronts</p>
        </div>
        {perms.planners.write && <NewPlannerForm businessType="merchandise" />}
      </div>
      <div className="rounded-xl border border-line bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3 font-medium">Business</th>
              <th className="px-5 py-3 font-medium">Storefront</th>
              <th className="px-5 py-3 font-medium">Default markup</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {(accounts ?? []).map((p) => (
              <tr key={p.id} className="border-b border-line last:border-0">
                <td className="px-5 py-4 font-medium">{p.business_name}</td>
                <td className="px-5 py-4">
                  <a
                    href={`${STOREFRONT_ORIGIN.merchandise}/store/${p.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-terracotta"
                  >
                    /store/{p.slug}
                  </a>
                </td>
                <td className="px-5 py-4 text-muted">{p.default_markup_pct}%</td>
                <td className="px-5 py-4">
                  <VettingStatusControl table="planners" id={p.id} status={p.status} canWrite={perms.planners.write} />
                </td>
                <td className="px-5 py-4 text-right">
                  {perms.planners.write && (
                    <Link href={`/admin/planners/${p.id}/edit`} className="text-xs text-terracotta font-medium">
                      Edit →
                    </Link>
                  )}
                </td>
              </tr>
            ))}
            {(accounts ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-muted">
                  No merchandise accounts yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
