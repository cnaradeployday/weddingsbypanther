import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategories, getPlannerBySlug, getStorefrontCatalog } from "@/lib/queries";
import { formatUSD } from "@/lib/format";

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

        <div>
          <p className="text-sm text-muted mb-4">{products.length} products</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-10">
            {products.map((p) => (
              <Link key={p.id} href={`${base}/shop/${p.slug}`} className="group">
                <div className="relative aspect-square rounded-xl overflow-hidden mb-3 bg-cream">
                  {p.image && (
                    <Image
                      src={p.image}
                      alt={p.name}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  )}
                  <span className="absolute top-3 left-3 text-[10px] uppercase tracking-wide bg-cream-light/90 px-2 py-1 rounded-full">
                    {p.categoryName}
                  </span>
                </div>
                <p className="font-medium text-sm">{p.name}</p>
                <p className="text-sm text-muted">
                  From {formatUSD(p.price)} · min {p.minOrder}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
