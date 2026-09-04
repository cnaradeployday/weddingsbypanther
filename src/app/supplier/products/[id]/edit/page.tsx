import { notFound, redirect } from "next/navigation";
import { getSessionProfile, createClient } from "@/lib/supabase/server";
import { SupplierProductForm, type InitialProduct } from "@/components/SupplierProductForm";
import type { Quad } from "@/components/PrintAreaTool";

export default async function EditSupplierProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  const supabase = await createClient();

  const { data: supplier } = await supabase
    .from("suppliers")
    .select("id")
    .eq("profile_id", session.user.id)
    .maybeSingle();
  if (!supplier) redirect("/login");

  const [{ data: categories }, { data: techniques }, { data: product }] = await Promise.all([
    supabase.from("categories").select("id, name").order("sort_order"),
    supabase.from("print_techniques").select("name").order("sort_order"),
    supabase
      .from("products")
      .select(
        `*, category:categories(business_type),
         images:product_images(id, url, sort_order),
         techniques:product_print_techniques(technique),
         zones:product_print_zones(width_mm, height_mm, max_chars_per_line, corners_pct, image_id),
         variants:product_variants(id, label, sku, price_delta, stock_on_hand, image_url, sort_order)`
      )
      .eq("id", id)
      .eq("supplier_id", supplier.id)
      .maybeSingle(),
  ]);

  if (!product) notFound();

  // Same rule as the admin edit page: a merchandise product's suggested
  // add-ons should only ever list other merchandise products, never wedding
  // ones, even though both verticals share this one `products` table.
  const businessType = product.category?.business_type === "merchandise" ? "merchandise" : "wedding";
  const { data: otherProductRows } = await supabase
    .from("products")
    .select("id, name, category:categories!inner(business_type)")
    .eq("category.business_type", businessType)
    .neq("id", id)
    .order("name");

  const zone = product.zones?.[0];
  const initial: InitialProduct = {
    id: product.id,
    name: product.name,
    description: product.description,
    categoryId: product.category_id ?? "",
    sku: product.sku,
    factoryPrice: product.factory_price,
    minOrder: product.min_order,
    popularQty: product.popular_qty,
    leadMin: product.lead_time_days_min,
    leadMax: product.lead_time_days_max,
    stock: product.stock_on_hand,
    personalizable: product.personalizable,
    allowSample: product.allow_sample,
    status: product.status,
    reviewerNote: product.reviewer_note,
    techniques: (product.techniques ?? []).map((t) => t.technique),
    styleTags: product.style_tags ?? [],
    relatedProductIds: product.related_product_ids ?? [],
    zone: zone
      ? {
          width: zone.width_mm ?? 60,
          height: zone.height_mm ?? 30,
          maxChars: zone.max_chars_per_line ?? 24,
          corners: zone.corners_pct as Quad,
          imageId: zone.image_id,
        }
      : null,
    images: (product.images ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((i) => ({ id: i.id, url: i.url })),
    variants: (product.variants ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((v) => ({
        id: v.id,
        label: v.label,
        sku: v.sku,
        priceDelta: v.price_delta,
        stock: v.stock_on_hand,
        imageUrl: v.image_url,
      })),
  };

  return (
    <div>
      <h1 className="font-serif text-3xl mb-1">{product.name}</h1>
      <p className="text-muted mb-8">Edit this product.</p>
      <SupplierProductForm
        supplierId={supplier.id}
        categories={categories ?? []}
        techniqueOptions={(techniques ?? []).map((t) => t.name)}
        otherProducts={(otherProductRows ?? []).map((p) => ({ id: p.id, name: p.name }))}
        initial={initial}
      />
    </div>
  );
}
