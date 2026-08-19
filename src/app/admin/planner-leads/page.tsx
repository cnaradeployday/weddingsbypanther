import { redirect } from "next/navigation";
import { getSessionProfile, createClient } from "@/lib/supabase/server";
import { getBackofficePermissions } from "@/lib/permissions";
import { LeadStatusSelect } from "@/components/LeadStatusSelect";

export default async function AdminPlannerLeadsPage() {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  const supabase = await createClient();
  const perms = await getBackofficePermissions(supabase, session.profile);

  const { data: leads } = await supabase
    .from("planner_leads")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="font-serif text-3xl mb-1">Planner leads</h1>
      <p className="text-muted mb-8">
        {leads?.length ?? 0} applications submitted from the &quot;Become a Planner&quot; form
      </p>

      {!leads || leads.length === 0 ? (
        <p className="text-muted">No applications yet.</p>
      ) : (
        <div className="space-y-4">
          {leads.map((lead) => (
            <div key={lead.id} className="rounded-xl border border-line bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
                <div>
                  <p className="font-medium">{lead.business_name}</p>
                  <p className="text-sm text-muted">
                    {lead.contact_name} ·{" "}
                    <a href={`mailto:${lead.email}`} className="hover:text-terracotta">
                      {lead.email}
                    </a>
                    {lead.phone && ` · ${lead.phone}`}
                  </p>
                  <p className="text-xs text-muted mt-1">
                    Submitted{" "}
                    {new Date(lead.created_at).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
                <LeadStatusSelect leadId={lead.id} status={lead.status} canWrite={perms.planners.write} />
              </div>

              <div className="rounded-lg bg-cream p-4 text-sm grid sm:grid-cols-2 gap-x-6 gap-y-1">
                {lead.website && (
                  <p>
                    <span className="text-muted">Website:</span>{" "}
                    <a href={lead.website} target="_blank" rel="noreferrer" className="hover:text-terracotta">
                      {lead.website}
                    </a>
                  </p>
                )}
                {(lead.address || lead.city || lead.country) && (
                  <p>
                    <span className="text-muted">Address:</span>{" "}
                    {[lead.address, lead.city, lead.country].filter(Boolean).join(", ")}
                  </p>
                )}
                {lead.years_in_business != null && (
                  <p>
                    <span className="text-muted">Years in the industry:</span> {lead.years_in_business}
                  </p>
                )}
                {lead.message && (
                  <p className="sm:col-span-2">
                    <span className="text-muted">Message:</span> {lead.message}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
