import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategories, getPlannerBySlug, getStorefrontCatalog } from "@/lib/queries";
import { CatalogSearch } from "@/components/CatalogSearch";
import { isBusinessType } from "@/lib/businessType";

export default async function ShopPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ category?: string }>;
}) {
  const { slug } = await params;
  const { category } = await searchParams;
  const planner = await getPlannerBySlug(slug);
  if (!planner) notFound();

  const [categories, allProducts] = await Promise.all([
    getCategories(isBusinessType(planner.business_type) ? planner.business_type : "wedding"),
    getStorefrontCatalog(slug),
  ]);

  const products = category
    ? allProducts.filter((p) => p.categorySlug === category)
    : allProducts;

  const activeCategory = categories.find((c) => c.slug === category);
  const base = `/store/${slug}`;

  const categoriesWithCounts = categories.map((cat) => ({
    id: cat.id,
    slug: cat.slug,
    name: cat.name,
    count: allProducts.filter((p) => p.categorySlug === cat.slug).length,
  }));

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      {planner.catalog_banner_url && (
        <div className="relative w-full aspect-[5/1] rounded-2xl overflow-hidden mb-8">
          <Image src={planner.catalog_banner_url} alt="" fill className="object-cover" priority />
        </div>
      )}
      <p className="text-sm text-muted mb-2">
        <Link href={base}>Home</Link> / Shop
        {activeCategory ? ` / ${activeCategory.name}` : ""}
      </p>
      <h1 className="font-serif text-4xl mb-8">
        {activeCategory ? activeCategory.name : "All Products"}
      </h1>

      <CatalogSearch
        products={products}
        base={base}
        categories={categoriesWithCounts}
        activeCategorySlug={category}
        totalCount={allProducts.length}
      />
    </div>
  );
}
