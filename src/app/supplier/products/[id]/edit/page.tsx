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

  const [{ data: categories }, { data: techniques }, { data: otherProductRows }] = await Promise.all([
    supabase.from("categories").select("id, name").order("sort_order"),
    supabase.from("print_techniques").select("name").order("sort_order"),
    supabase.from("products").select("id, name").neq("id", id).order("name"),
  ]);

  const { data: product } = await supabase
    .from("products")
    .select(
      `*, images:product_images(id, url, sort_order),
       techniques:product_print_techniques(technique),
       zones:product_print_zones(width_mm, height_mm, max_chars_per_line, corners_pct, image_id),
       variants:product_variants(id, label, sku, price_delta, stock_on_hand, image_url, sort_order)`
    )
    .eq("id", id)
    .eq("supplier_id", supplier.id)
    .maybeSingle();

  if (!product) notFound();

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
        otherProducts={otherProductRows ?? []}
        initial={initial}
      />
    </div>
  );
}
