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
          storefront_subtitle: planner.storefront_subtitle,
          initials: planner.initials,
          default_markup_pct: planner.default_markup_pct,
          logo_url: planner.logo_url,
          accent_color: planner.accent_color,
          secondary_color: planner.secondary_color,
          font_choice: planner.font_choice,
          storefront_banner_url: planner.storefront_banner_url,
          catalog_banner_url: planner.catalog_banner_url,
          ai_render_enabled: planner.ai_render_enabled,
        }}
      />
    </div>
  );
}
