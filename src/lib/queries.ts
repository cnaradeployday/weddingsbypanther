import { supabase } from "./supabase";
import { applyMarkup } from "./format";
import { techniqueInkColor } from "./printTechniqueColors";

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
  styleTags: string[];
};

export type RelatedProduct = {
  id: string;
  slug: string;
  name: string;
  price: number;
  minOrder: number;
  personalizable: boolean;
  image: string | null;
  zone: {
    width_mm: number | null;
    height_mm: number | null;
    corners_pct: { x: number; y: number }[];
  } | null;
  inkColor: string;
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

export async function getPlanners() {
  const { data } = await supabase
    .from("planners")
    .select("id, slug, business_name, tagline, initials, logo_url, accent_color")
    .eq("status", "approved")
    .order("business_name");
  return data ?? [];
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
         id, slug, name, description, factory_price, min_order, personalizable, status, style_tags,
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
        styleTags: p.style_tags ?? [],
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

  // Two separate, unambiguous queries instead of filtering a nested
  // (products) column through the planner_products embed — PostgREST only
  // nulls out a non-matching to-one embed rather than excluding the row,
  // which made that shortcut unreliable.
  const [{ data: p, error: productError }, { data: techniqueCatalog }] = await Promise.all([
    supabase
      .from("products")
      .select(
        `*,
         category:categories ( name, slug ),
         supplier:suppliers ( business_name ),
         images:product_images ( id, url, sort_order ),
         techniques:product_print_techniques ( id, technique, extra_price, is_default ),
         zones:product_print_zones ( id, label, width_mm, height_mm, max_chars_per_line, max_lines, corners_pct, image_id ),
         variants:product_variants ( id, label, sku, price_delta, image_url, sort_order )`
      )
      .eq("slug", productSlug)
      .eq("status", "approved")
      .maybeSingle(),
    supabase.from("print_techniques").select("name, strip_source_color"),
  ]);

  if (productError || !p) return null;

  const { data: link, error: linkError } = await supabase
    .from("planner_products")
    .select("markup_pct")
    .eq("planner_id", planner.id)
    .eq("product_id", p.id)
    .eq("enabled", true)
    .maybeSingle();

  if (linkError || !link) return null;

  const images = (p.images ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);
  const techniques = (p.techniques ?? []).map((t) => ({
    ...t,
    stripSourceColor:
      (techniqueCatalog ?? []).find((tc) => tc.name.trim().toLowerCase() === t.technique.trim().toLowerCase())
        ?.strip_source_color ?? false,
  }));
  const zones = (p.zones ?? []).map((z) => ({
    ...z,
    corners_pct: (z.corners_pct as { x: number; y: number }[] | null) ?? [],
  }));
  const variants = (p.variants ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);

  return {
    planner,
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description,
    factoryPrice: p.factory_price,
    markupPct: link.markup_pct,
    unitPrice: applyMarkup(p.factory_price, link.markup_pct),
    minOrder: p.min_order,
    popularQty: p.popular_qty,
    leadTimeMin: p.lead_time_days_min,
    leadTimeMax: p.lead_time_days_max,
    personalizable: p.personalizable,
    categoryName: p.category?.name ?? "",
    supplierName: p.supplier?.business_name ?? "",
    images: images.map((i) => ({ id: i.id, url: i.url })),
    techniques,
    zones,
    variants,
    relatedProductIds: p.related_product_ids ?? [],
  };
}

// Related products a customer sees suggested below the configurator —
// restricted to this planner's own enabled catalog (same rule as the main
// catalog) so a supplier's cross-sell pick never surfaces a product this
// particular store doesn't actually carry.
export async function getRelatedProducts(
  plannerSlug: string,
  productIds: string[]
): Promise<RelatedProduct[]> {
  if (productIds.length === 0) return [];
  const planner = await getPlannerBySlug(plannerSlug);
  if (!planner) return [];

  const { data: rows } = await supabase
    .from("planner_products")
    .select(
      `markup_pct, enabled,
       product:products (
         id, slug, name, factory_price, min_order, personalizable, status,
         images:product_images ( url, sort_order ),
         techniques:product_print_techniques ( technique, is_default ),
         zones:product_print_zones ( width_mm, height_mm, corners_pct )
       )`
    )
    .eq("planner_id", planner.id)
    .eq("enabled", true)
    .in("product_id", productIds);

  return (rows ?? [])
    .filter((row) => row.product && row.product.status === "approved")
    .map((row) => {
      const p = row.product!;
      const images = (p.images ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);
      const defaultTechnique = (p.techniques ?? []).find((t) => t.is_default) ?? p.techniques?.[0];
      const zone = p.zones?.[0];
      return {
        id: p.id,
        slug: p.slug,
        name: p.name,
        price: applyMarkup(p.factory_price, row.markup_pct),
        minOrder: p.min_order,
        personalizable: p.personalizable,
        image: images[0]?.url ?? null,
        zone: zone
          ? {
              width_mm: zone.width_mm,
              height_mm: zone.height_mm,
              corners_pct: (zone.corners_pct as { x: number; y: number }[] | null) ?? [],
            }
          : null,
        inkColor: techniqueInkColor(defaultTechnique?.technique),
      };
    });
}
