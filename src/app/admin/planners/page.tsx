import { redirect } from "next/navigation";
import { getSessionProfile, createClient } from "@/lib/supabase/server";
import { VettingStatusControl } from "@/components/VettingStatusControl";
import { getBackofficePermissions } from "@/lib/permissions";

export default async function AdminPlannersPage() {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  const supabase = await createClient();
  const perms = await getBackofficePermissions(supabase, session.profile);

  const { data: planners } = await supabase.from("planners").select("*").order("business_name");

  return (
    <div>
      <h1 className="font-serif text-3xl mb-1">Planners</h1>
      <p className="text-muted mb-8">{planners?.length ?? 0} planner storefronts</p>
      <div className="rounded-xl border border-line bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3 font-medium">Studio</th>
              <th className="px-5 py-3 font-medium">Storefront</th>
              <th className="px-5 py-3 font-medium">Default markup</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {(planners ?? []).map((p) => (
              <tr key={p.id} className="border-b border-line last:border-0">
                <td className="px-5 py-4 font-medium">{p.business_name}</td>
                <td className="px-5 py-4">
                  <a href={`/store/${p.slug}`} target="_blank" rel="noreferrer" className="text-terracotta">
                    /store/{p.slug}
                  </a>
                </td>
                <td className="px-5 py-4 text-muted">{p.default_markup_pct}%</td>
                <td className="px-5 py-4">
                  <VettingStatusControl table="planners" id={p.id} status={p.status} canWrite={perms.planners.write} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
