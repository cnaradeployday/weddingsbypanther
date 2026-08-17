import { supabase } from "./supabase";
import { applyMarkup } from "./format";

export type CatalogProduct = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  factoryPrice: number;
  price: number;
  minOrder: number;
  personalizable: boolean;
  categoryName: string;
  categorySlug: string;
  supplierName: string;
  image: string | null;
};

export async function getPlannerBySlug(slug: string) {
  const { data, error } = await supabase
    .from("planners")
    .select("*")
    .eq("slug", slug)
    .single();
  if (error) return null;
  return data;
}

export async function getCategories() {
  const { data } = await supabase
    .from("categories")
    .select("*")
    .order("sort_order");
  return data ?? [];
}

export async function getStorefrontCatalog(plannerSlug: string): Promise<CatalogProduct[]> {
  const planner = await getPlannerBySlug(plannerSlug);
  if (!planner) return [];

  const { data, error } = await supabase
    .from("planner_products")
    .select(
      `markup_pct, enabled,
       product:products (
         id, slug, name, description, factory_price, min_order, personalizable, status,
         category:categories ( name, slug ),
         supplier:suppliers ( business_name ),
         images:product_images ( url, sort_order )
       )`
    )
    .eq("planner_id", planner.id)
    .eq("enabled", true);

  if (error || !data) return [];

  return data
    .filter((row) => row.product && row.product.status === "approved")
    .map((row) => {
      const p = row.product!;
      const images = (p.images ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);
      return {
        id: p.id,
        slug: p.slug,
        name: p.name,
        description: p.description,
        factoryPrice: p.factory_price,
        price: applyMarkup(p.factory_price, row.markup_pct),
        minOrder: p.min_order,
        personalizable: p.personalizable,
        categoryName: p.category?.name ?? "",
        categorySlug: p.category?.slug ?? "",
        supplierName: p.supplier?.business_name ?? "",
        image: images[0]?.url ?? null,
      };
    });
}

export async function getProposal(proposalId: string) {
  const { data: proposal, error } = await supabase
    .from("proposals")
    .select("*")
    .eq("id", proposalId)
    .maybeSingle();

  if (error || !proposal) return null;

  const { data: options } = await supabase
    .from("proposal_options")
    .select(
      `*, items:proposal_option_items (
        quantity, unit_price,
        product:products ( id, slug, name, images:product_images ( url, sort_order ) )
      )`
    )
    .eq("proposal_id", proposalId)
    .order("sort_order");

  return {
    proposal,
    options: (options ?? []).map((opt) => ({
      id: opt.id,
      label: opt.label,
      tier: opt.tier,
      totalPrice: opt.total_price,
      items: (opt.items ?? []).map((it) => {
        const images = (it.product?.images ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);
        return {
          productId: it.product?.id ?? "",
          slug: it.product?.slug ?? "",
          name: it.product?.name ?? "",
          image: images[0]?.url ?? null,
          quantity: it.quantity,
          unitPrice: it.unit_price,
        };
      }),
    })),
  };
}

export async function getStorefrontProduct(plannerSlug: string, productSlug: string) {
  const planner = await getPlannerBySlug(plannerSlug);
  if (!planner) return null;

  const { data, error } = await supabase
    .from("planner_products")
    .select(
      `markup_pct,
       product:products (
         *,
         category:categories ( name, slug ),
         supplier:suppliers ( business_name ),
         images:product_images ( url, sort_order ),
         techniques:product_print_techniques ( id, technique, extra_price, is_default ),
         zones:product_print_zones ( id, label, width_mm, height_mm, max_chars_per_line, max_lines )
       )`
    )
    .eq("planner_id", planner.id)
    .eq("enabled", true)
    .eq("product.slug", productSlug)
    .maybeSingle();

  if (error || !data || !data.product) return null;

  const p = data.product;
  const images = (p.images ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);
  const techniques = (p.techniques ?? []).slice();
  const zones = p.zones ?? [];

  return {
    planner,
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description,
    factoryPrice: p.factory_price,
    markupPct: data.markup_pct,
    unitPrice: applyMarkup(p.factory_price, data.markup_pct),
    minOrder: p.min_order,
    leadTimeMin: p.lead_time_days_min,
    leadTimeMax: p.lead_time_days_max,
    personalizable: p.personalizable,
    categoryName: p.category?.name ?? "",
    supplierName: p.supplier?.business_name ?? "",
    images: images.map((i) => i.url),
    techniques,
    zones,
  };
}
