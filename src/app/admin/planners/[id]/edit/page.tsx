import { notFound, redirect } from "next/navigation";
import { getSessionProfile, createClient } from "@/lib/supabase/server";
import { getBackofficePermissions } from "@/lib/permissions";
import { PlannerSettingsForm } from "@/components/PlannerSettingsForm";
import { PlannerProductsTable, type PlannerProductRow } from "@/components/PlannerProductsTable";
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

  // The full catalog this storefront could carry (every product in its own
  // vertical), left-joined in JS against this planner's actual
  // planner_products links — a product with no link yet still gets a row
  // here (disabled, at the store's default markup) so admins can turn on
  // products a planner was never linked to in the first place, not just
  // toggle ones already linked.
  const [{ data: catalogProducts }, { data: links }] = await Promise.all([
    supabase
      .from("products")
      .select(
        `id, name, sku, factory_price,
         category:categories!inner ( name, business_type ),
         supplier:suppliers ( business_name )`
      )
      .eq("category.business_type", businessType)
      .order("name"),
    supabase.from("planner_products").select("id, product_id, markup_pct, enabled").eq("planner_id", planner.id),
  ]);

  const linkByProduct = new Map((links ?? []).map((l) => [l.product_id, l]));
  const productRows: PlannerProductRow[] = (catalogProducts ?? []).map((p) => {
    const link = linkByProduct.get(p.id);
    return {
      id: link?.id ?? null,
      productId: p.id,
      name: p.name,
      sku: p.sku,
      categoryName: p.category?.name ?? "",
      supplierName: p.supplier?.business_name ?? "",
      factoryPrice: p.factory_price,
      markupPct: link?.markup_pct ?? planner.default_markup_pct,
      enabled: link?.enabled ?? false,
    };
  });

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

      <h2 className="font-serif text-2xl mt-12 mb-1">Storefront catalog</h2>
      <p className="text-muted mb-6">
        Turn products from {businessType === "merchandise" ? "the merchandise" : "the wedding"}{" "}
        catalog on or off for this storefront, and set each one&apos;s markup.
      </p>
      <PlannerProductsTable plannerId={planner.id} rows={productRows} />
    </div>
  );
}
