import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategories, getPlannerBySlug, getStorefrontCatalog } from "@/lib/queries";
import { CatalogSearch } from "@/components/CatalogSearch";

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
    getCategories(),
    getStorefrontCatalog(slug),
  ]);

  const products = category
    ? allProducts.filter((p) => p.categorySlug === category)
    : allProducts;

  const activeCategory = categories.find((c) => c.slug === category);
  const base = `/store/${slug}`;

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <p className="text-sm text-muted mb-2">
        <Link href={base}>Home</Link> / Shop
        {activeCategory ? ` / ${activeCategory.name}` : ""}
      </p>
      <h1 className="font-serif text-4xl mb-8">
        {activeCategory ? activeCategory.name : "All Products"}
      </h1>

      <div className="grid md:grid-cols-[220px_1fr] gap-10">
        <aside>
          <p className="text-xs uppercase tracking-wide text-muted mb-3">Category</p>
          <ul className="space-y-2 text-sm">
            <li>
              <Link
                href={`${base}/shop`}
                className={!category ? "font-semibold text-terracotta" : "text-dark/80 hover:text-terracotta"}
              >
                All ({allProducts.length})
              </Link>
            </li>
            {categories.map((cat) => {
              const count = allProducts.filter((p) => p.categorySlug === cat.slug).length;
              return (
                <li key={cat.id}>
                  <Link
                    href={`${base}/shop?category=${cat.slug}`}
                    className={
                      category === cat.slug
                        ? "font-semibold text-terracotta"
                        : "text-dark/80 hover:text-terracotta"
                    }
                  >
                    {cat.name} ({count})
                  </Link>
                </li>
              );
            })}
          </ul>
        </aside>

        <CatalogSearch products={products} base={base} />
      </div>
    </div>
  );
}
