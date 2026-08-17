import { redirect } from "next/navigation";
import { getSessionProfile, createClient } from "@/lib/supabase/server";
import { formatUSD } from "@/lib/format";

export default async function PlannerProposalsPage() {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  const supabase = await createClient();

  const { data: planner } = await supabase
    .from("planners")
    .select("id, slug")
    .eq("profile_id", session.user.id)
    .maybeSingle();
  if (!planner) redirect("/login");

  const { data: proposals } = await supabase
    .from("proposals")
    .select("*, options:proposal_options(total_price)")
    .eq("planner_id", planner.id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="font-serif text-3xl mb-1">Proposals</h1>
      <p className="text-muted mb-8">
        {proposals?.length ?? 0} proposals generated from your Proposal Builder
      </p>

      {!proposals || proposals.length === 0 ? (
        <p className="text-muted">No proposals yet.</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {proposals.map((p) => {
            const best = (p.options ?? []).reduce(
              (min, o) => Math.min(min, o.total_price),
              Infinity
            );
            return (
              <a
                key={p.id}
                href={`/store/${planner.slug}/proposals/${p.id}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-line bg-white p-5 hover:border-dark/40 transition-colors"
              >
                <div className="flex justify-between mb-2">
                  <p className="font-medium">{p.guest_count} guests</p>
                  <p className="text-sm text-muted">
                    {new Date(p.created_at).toLocaleDateString()}
                  </p>
                </div>
                <p className="text-sm text-muted mb-3">
                  Budget {formatUSD(p.budget)} · {(p.style_preferences ?? []).join(", ") || "No style set"}
                </p>
                {Number.isFinite(best) && (
                  <p className="text-sm">
                    Options from <span className="font-medium">{formatUSD(best)}</span>
                  </p>
                )}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
