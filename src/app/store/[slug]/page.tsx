import { notFound } from "next/navigation";
import { getCategories, getPlannerBySlug, getStorefrontCatalog } from "@/lib/queries";
import { isBusinessType } from "@/lib/businessType";
import { isStorefrontTemplateId } from "@/lib/storefrontTemplates";
import { ClassicHome } from "@/components/storefront-templates/ClassicHome";
import { ModernHome } from "@/components/storefront-templates/ModernHome";
import { BoldHome } from "@/components/storefront-templates/BoldHome";

const CATEGORY_IMAGES: Record<string, string> = {
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
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
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

  const templateProps = {
    plannerBusinessName: planner.business_name,
    storefrontBannerUrl: planner.storefront_banner_url,
    categories,
    categoryImages: CATEGORY_IMAGES,
    products,
    base,
    showProposalBuilder,
  };

  const template = isStorefrontTemplateId(planner.template) ? planner.template : "classic";
  if (template === "modern") return <ModernHome {...templateProps} />;
  if (template === "bold") return <BoldHome {...templateProps} />;
  return <ClassicHome {...templateProps} />;
}
