import type { CatalogProduct } from "@/lib/queries";

// Shared shape every storefront home template renders from — "necesito
// poder tener mas de un template del front... la idea es que sean todas
// distintas". Each template is a pure presentational component (same
// data in, a deliberately different layout out) so StorefrontHome
// (src/app/store/[slug]/page.tsx) can pick among them by the planner's
// own `template` column without touching the data-fetching above it.
export type StorefrontTemplateProps = {
  plannerBusinessName: string;
  storefrontBannerUrl: string | null;
  categories: { id: string; slug: string; name: string }[];
  categoryImages: Record<string, string>;
  products: CatalogProduct[];
  base: string;
  showProposalBuilder: boolean;
};
