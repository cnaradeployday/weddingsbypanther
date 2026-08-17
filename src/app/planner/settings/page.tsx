import { redirect } from "next/navigation";
import { getSessionProfile, createClient } from "@/lib/supabase/server";
import { PlannerSettingsForm } from "@/components/PlannerSettingsForm";

export default async function PlannerSettingsPage() {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  const supabase = await createClient();

  const { data: planner } = await supabase
    .from("planners")
    .select("*")
    .eq("profile_id", session.user.id)
    .maybeSingle();
  if (!planner) redirect("/login");

  return (
    <div>
      <h1 className="font-serif text-3xl mb-1">Storefront settings</h1>
      <p className="text-muted mb-8">
        Your storefront is live at /store/{planner.slug}
      </p>
      <PlannerSettingsForm
        plannerId={planner.id}
        initial={{
          business_name: planner.business_name,
          tagline: planner.tagline,
          initials: planner.initials,
          default_markup_pct: planner.default_markup_pct,
        }}
      />
    </div>
  );
}
