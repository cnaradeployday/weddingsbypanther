import { redirect } from "next/navigation";
import { getSessionProfile, createClient } from "@/lib/supabase/server";
import { PlannerSettingsForm } from "@/components/PlannerSettingsForm";
import { isBusinessType, STOREFRONT_ORIGIN } from "@/lib/businessType";

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

  const businessType = isBusinessType(planner.business_type) ? planner.business_type : "wedding";
  const storefrontUrl = `${STOREFRONT_ORIGIN[businessType]}/store/${planner.slug}`;

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, slug")
    .eq("business_type", businessType)
    .order("sort_order");

  return (
    <div>
      <h1 className="font-serif text-3xl mb-1">Storefront settings</h1>
      <p className="text-muted mb-8">
        Your storefront is live at /store/{planner.slug}
      </p>
      <PlannerSettingsForm
        plannerId={planner.id}
        storefrontUrl={storefrontUrl}
        categories={categories ?? []}
        initial={{
          business_name: planner.business_name,
          tagline: planner.tagline,
          storefront_subtitle: planner.storefront_subtitle,
          initials: planner.initials,
          default_markup_pct: planner.default_markup_pct,
          logo_url: planner.logo_url,
          accent_color: planner.accent_color,
          secondary_color: planner.secondary_color,
          header_footer_text_color: planner.header_footer_text_color,
          font_choice: planner.font_choice,
          template: planner.template,
          storefront_banner_url: planner.storefront_banner_url,
          catalog_banner_url: planner.catalog_banner_url,
          category_banner_overrides: (planner.category_banner_overrides as Record<string, string>) ?? {},
          ai_render_enabled: planner.ai_render_enabled,
          about_text: planner.about_text,
          contact_email: planner.contact_email,
          contact_phone: planner.contact_phone,
          contact_address: planner.contact_address,
        }}
      />
    </div>
  );
}
