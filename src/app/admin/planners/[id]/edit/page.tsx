import { notFound, redirect } from "next/navigation";
import { getSessionProfile, createClient } from "@/lib/supabase/server";
import { getBackofficePermissions } from "@/lib/permissions";
import { PlannerSettingsForm } from "@/components/PlannerSettingsForm";
import { VettingStatusControl } from "@/components/VettingStatusControl";
import { isBusinessType, STOREFRONT_ORIGIN } from "@/lib/businessType";

export default async function EditPlannerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  const supabase = await createClient();
  const perms = await getBackofficePermissions(supabase, session.profile);
  if (!perms.planners.write) redirect("/admin/planners");

  const { data: planner } = await supabase.from("planners").select("*").eq("id", id).maybeSingle();
  if (!planner) notFound();

  const businessType = isBusinessType(planner.business_type) ? planner.business_type : "wedding";
  const storefrontUrl = `${STOREFRONT_ORIGIN[businessType]}/store/${planner.slug}`;

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-1">
        <h1 className="font-serif text-3xl">{planner.business_name}</h1>
        <VettingStatusControl table="planners" id={planner.id} status={planner.status} />
      </div>
      <p className="text-muted mb-8">
        Storefront live at{" "}
        <a
          href={storefrontUrl}
          target="_blank"
          rel="noreferrer"
          className="text-terracotta underline underline-offset-2"
        >
          {storefrontUrl.replace(/^https?:\/\//, "")}
        </a>{" "}
        — everything here is exactly what this planner can edit themselves from their own Storefront
        settings.
      </p>
      <PlannerSettingsForm
        plannerId={planner.id}
        initial={{
          business_name: planner.business_name,
          tagline: planner.tagline,
          initials: planner.initials,
          default_markup_pct: planner.default_markup_pct,
          logo_url: planner.logo_url,
          accent_color: planner.accent_color,
          secondary_color: planner.secondary_color,
          font_choice: planner.font_choice,
          storefront_banner_url: planner.storefront_banner_url,
          catalog_banner_url: planner.catalog_banner_url,
        }}
      />
    </div>
  );
}
