import { notFound } from "next/navigation";
import { getCategories, getPlannerBySlug, getStorefrontCatalog } from "@/lib/queries";
import { isBusinessType } from "@/lib/businessType";
import { isStorefrontTemplateId } from "@/lib/storefrontTemplates";
import { ClassicHome } from "@/components/storefront-templates/ClassicHome";
import { ModernHome } from "@/components/storefront-templates/ModernHome";
import { BoldHome } from "@/components/storefront-templates/BoldHome";
import { EditorialHome } from "@/components/storefront-templates/EditorialHome";
import { MinimalHome } from "@/components/storefront-templates/MinimalHome";
import { GalleryHome } from "@/components/storefront-templates/GalleryHome";
import { BoutiqueHome } from "@/components/storefront-templates/BoutiqueHome";
import { PlayfulHome } from "@/components/storefront-templates/PlayfulHome";
import { GridHome } from "@/components/storefront-templates/GridHome";
import { ShowcaseHome } from "@/components/storefront-templates/ShowcaseHome";

// Fallback for any category an admin hasn't uploaded a real banner for yet
// (see /admin/categories) — keeps existing storefronts looking the same
// until each one is replaced with the admin's own image.
const DEFAULT_CATEGORY_IMAGES: Record<string, string> = {
  "wedding-favors": "/images/favors-ringbox-flatlay.jpg",
  centerpieces: "/images/centerpieces-gold-chandelier.jpg",
  "table-numbers": "/images/tablenumbers-long-table.jpg",
  "place-cards": "/images/placecards-waxseal-charger.jpg",
  "guest-books": "/images/guestbooks-waxseal-press.jpg",
  "welcome-bags": "/images/welcomebags-floral-card.jpg",
  notebooks: "/images/merch-placeholder-notebooks.png",
  drinkware: "/images/merch-placeholder-drinkware.png",
  bags: "/images/merch-placeholder-bags.png",
  writing: "/images/merch-placeholder-writing.png",
};

export default async function StorefrontHome({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ previewTemplate?: string }>;
}) {
  const { slug } = await params;
  // "al lado de los templates, como se ve el front de esa web en
  // cuestion" — the Storefront template picker (PlannerSettingsForm) embeds
  // this exact page in a preview iframe with this query param, so an
  // admin/planner can see the real page (their real data/branding) render
  // under a template they haven't saved yet. Public and harmless: it only
  // picks which already-public layout renders, never anything private.
  const { previewTemplate } = await searchParams;
  const planner = await getPlannerBySlug(slug);
  if (!planner) notFound();

  const [categories, products] = await Promise.all([
    getCategories(isBusinessType(planner.business_type) ? planner.business_type : "wedding"),
    getStorefrontCatalog(slug),
  ]);

  const base = `/store/${slug}`;
  // The "budget in, ideas out" proposal builder is a wedding-specific
  // concept — a promotional-merchandise storefront just shops a catalog.
  const showProposalBuilder = planner.business_type !== "merchandise";

  // "los banners de las categorias se tienen que poder modificar desde el
  // backoffice" — each category's own banner_url (set in /admin/categories)
  // now wins; the old hardcoded image only fills in for a category nobody
  // has uploaded one for yet.
  const categoryImages: Record<string, string> = {};
  for (const cat of categories) {
    const image = cat.banner_url ?? DEFAULT_CATEGORY_IMAGES[cat.slug];
    if (image) categoryImages[cat.slug] = image;
  }

  const templateProps = {
    plannerBusinessName: planner.business_name,
    storefrontBannerUrl: planner.storefront_banner_url,
    categories,
    categoryImages,
    products,
    base,
    showProposalBuilder,
  };

  const template =
    (previewTemplate && isStorefrontTemplateId(previewTemplate) ? previewTemplate : null) ??
    (isStorefrontTemplateId(planner.template) ? planner.template : "classic");
  if (template === "modern") return <ModernHome {...templateProps} />;
  if (template === "bold") return <BoldHome {...templateProps} />;
  if (template === "editorial") return <EditorialHome {...templateProps} />;
  if (template === "minimal") return <MinimalHome {...templateProps} />;
  if (template === "gallery") return <GalleryHome {...templateProps} />;
  if (template === "boutique") return <BoutiqueHome {...templateProps} />;
  if (template === "playful") return <PlayfulHome {...templateProps} />;
  if (template === "grid") return <GridHome {...templateProps} />;
  if (template === "showcase") return <ShowcaseHome {...templateProps} />;
  return <ClassicHome {...templateProps} />;
}
