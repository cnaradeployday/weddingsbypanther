import { notFound } from "next/navigation";
import { getStorefrontProduct, getRelatedProducts } from "@/lib/queries";
import { getSessionProfile } from "@/lib/supabase/server";
import { ProductConfigurator } from "@/components/ProductConfigurator";
import { isBusinessType } from "@/lib/businessType";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string; product: string }>;
}) {
  const { slug, product: productSlug } = await params;
  const [product, session] = await Promise.all([
    getStorefrontProduct(slug, productSlug),
    getSessionProfile(),
  ]);
  if (!product) notFound();

  const relatedProducts = await getRelatedProducts(slug, product.relatedProductIds);

  const unlimitedRenders = session?.profile.role === "admin";

  return (
    <ProductConfigurator
      unlimitedRenders={unlimitedRenders}
      product={{
        id: product.id,
        slug: product.slug,
        name: product.name,
        description: product.description,
        categoryName: product.categoryName,
        supplierName: product.supplierName,
        unitPrice: product.unitPrice,
        minOrder: product.minOrder,
        popularQty: product.popularQty,
        allowSample: product.allowSample,
        leadTimeMin: product.leadTimeMin,
        leadTimeMax: product.leadTimeMax,
        personalizable: product.personalizable,
        factoryPrice: product.factoryPrice,
        markupPct: product.markupPct,
        images: product.images,
        techniques: product.techniques,
        zones: product.zones,
        variants: product.variants,
        plannerSlug: slug,
        businessType: isBusinessType(product.planner.business_type) ? product.planner.business_type : "wedding",
        aiRenderEnabled: product.planner.ai_render_enabled,
      }}
      relatedProducts={relatedProducts}
    />
  );
}
