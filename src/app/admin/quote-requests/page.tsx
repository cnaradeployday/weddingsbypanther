import { redirect } from "next/navigation";
import { getSessionProfile, createClient } from "@/lib/supabase/server";
import { getBackofficePermissions } from "@/lib/permissions";
import { QuoteStatusSelect } from "@/components/QuoteStatusSelect";

// Bulk-order enquiries submitted from a merchandise storefront's "Request a
// volume quote" form — gated under the same backoffice section as Orders,
// since these are pre-sale requests headed toward becoming one.
export default async function AdminQuoteRequestsPage() {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  const supabase = await createClient();
  const perms = await getBackofficePermissions(supabase, session.profile);

  const { data: requests } = await supabase
    .from("quote_requests")
    .select(
      `*, product:products(name, slug), planner:planners(business_name, slug)`
    )
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="font-serif text-3xl mb-1">Quote requests</h1>
      <p className="text-muted mb-8">
        {requests?.length ?? 0} volume-quote requests submitted from merchandise storefronts
      </p>

      {!requests || requests.length === 0 ? (
        <p className="text-muted">No quote requests yet.</p>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <div key={req.id} className="rounded-xl border border-line bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
                <div>
                  <p className="font-medium">
                    {req.product?.name ?? "Deleted product"} · {req.quantity} units
                  </p>
                  <p className="text-sm text-muted">
                    {req.contact_name}
                    {req.company_name && ` (${req.company_name})`} ·{" "}
                    <a href={`mailto:${req.email}`} className="hover:text-terracotta">
                      {req.email}
                    </a>
                    {req.phone && ` · ${req.phone}`}
                  </p>
                  <p className="text-xs text-muted mt-1">
                    {req.planner?.business_name ?? "Unknown storefront"} · Submitted{" "}
                    {new Date(req.created_at).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
                <QuoteStatusSelect requestId={req.id} status={req.status} canWrite={perms.orders.write} />
              </div>
              {req.message && (
                <div className="rounded-lg bg-cream p-4 text-sm">
                  <span className="text-muted">Message:</span> {req.message}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
