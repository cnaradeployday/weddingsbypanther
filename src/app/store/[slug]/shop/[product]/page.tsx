import { notFound } from "next/navigation";
import { getStorefrontProduct } from "@/lib/queries";
import { ProductConfigurator } from "@/components/ProductConfigurator";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string; product: string }>;
}) {
  const { slug, product: productSlug } = await params;
  const product = await getStorefrontProduct(slug, productSlug);
  if (!product) notFound();

  return (
    <ProductConfigurator
      product={{
        id: product.id,
        slug: product.slug,
        name: product.name,
        description: product.description,
        categoryName: product.categoryName,
        supplierName: product.supplierName,
        unitPrice: product.unitPrice,
        minOrder: product.minOrder,
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
      }}
    />
  );
}
