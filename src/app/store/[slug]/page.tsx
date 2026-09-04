import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategories, getPlannerBySlug, getStorefrontCatalog } from "@/lib/queries";
import { formatUSD } from "@/lib/format";
import { isBusinessType } from "@/lib/businessType";

const CATEGORY_IMAGES: Record<string, string> = {
  "wedding-favors": "/images/favors-ringbox-flatlay.jpg",
  centerpieces: "/images/centerpieces-gold-chandelier.jpg",
  "table-numbers": "/images/tablenumbers-long-table.jpg",
  "place-cards": "/images/placecards-waxseal-charger.jpg",
  "guest-books": "/images/guestbooks-waxseal-press.jpg",
  "welcome-bags": "/images/welcomebags-floral-card.jpg",
  notebooks: "/images/merch-placeholder-notebooks.png",
  drinkware: "/images/merch-placeholder-drinkware.png",
  bags: "/images/merch-placeholder-bags.png",
  writing: "/images/merch-placeholder-writing.png",
};

export default async function StorefrontHome({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const planner = await getPlannerBySlug(slug);
  if (!planner) notFound();

  const [categories, products] = await Promise.all([
    getCategories(isBusinessType(planner.business_type) ? planner.business_type : "wedding"),
    getStorefrontCatalog(slug),
  ]);

  const featured = products.slice(0, 4);
  const base = `/store/${slug}`;

  return (
    <div>
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-6 pt-16 pb-20 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-terracotta mb-4">
              Curated by {planner.business_name}
            </p>
            <h1 className="font-serif text-5xl md:text-6xl leading-[1.05] mb-6">
              Details that feel
              <br />
              <em className="italic">like the two of you.</em>
            </h1>
            <p className="text-muted max-w-md mb-8">
              A hand-picked collection of {products.length} pieces, personalized in our
              studio and delivered to your venue.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href={`${base}/shop`}
                className="px-6 py-3 rounded-full bg-terracotta text-cream-light text-sm font-medium hover:bg-terracotta-dark transition-colors"
              >
                Browse Products
              </Link>
              <Link
                href={`${base}/builder`}
                className="px-6 py-3 rounded-full border border-dark/20 text-sm font-medium hover:border-dark transition-colors"
              >
                Build My Proposal
              </Link>
            </div>
          </div>
          <div className="relative h-[420px] rounded-2xl overflow-hidden">
            <Image
              src={planner.storefront_banner_url || "/images/hero-tablescape.jpg"}
              alt="Wedding tablescape"
              fill
              className="object-cover"
              priority
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-20">
        <div className="grid md:grid-cols-2 gap-6 mb-14">
          <Link
            href={`${base}/shop`}
            className="rounded-2xl border border-line p-8 flex items-center justify-between hover:border-dark/40 transition-colors"
          >
            <div>
              <h2 className="font-serif text-2xl mb-1">Browse Products</h2>
              <p className="text-sm text-muted">
                {products.length} pieces, hand-picked and ready to personalize.
              </p>
            </div>
            <span className="text-terracotta text-sm shrink-0">Explore →</span>
          </Link>
          <Link
            href={`${base}/builder`}
            className="rounded-2xl bg-sage text-cream-light p-8 flex items-center justify-between hover:opacity-95 transition-opacity"
          >
            <div>
              <h2 className="font-serif text-2xl mb-1">Build My Proposal</h2>
              <p className="text-sm text-cream-light/75">
                Budget in, a complete set of ideas out.
              </p>
            </div>
            <span className="text-gold text-sm shrink-0">Start →</span>
          </Link>
        </div>

        <h2 className="font-serif text-3xl mb-6">Shop by category</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-16">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`${base}/shop?category=${cat.slug}`}
              className="relative h-44 rounded-xl overflow-hidden group"
            >
              <Image
                src={CATEGORY_IMAGES[cat.slug] ?? "/images/hero-tablescape.jpg"}
                alt={cat.name}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              <span className="absolute bottom-3 left-4 text-cream-light font-serif text-lg">
                {cat.name}
              </span>
            </Link>
          ))}
        </div>

        {featured.length > 0 && (
          <>
            <h2 className="font-serif text-3xl mb-6">Featured this season</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {featured.map((p) => (
                <Link key={p.id} href={`${base}/shop/${p.slug}`} className="group">
                  <div className="relative aspect-square rounded-xl overflow-hidden mb-3">
                    {p.image && (
                      <Image
                        src={p.image}
                        alt={p.name}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    )}
                  </div>
                  <p className="font-medium text-sm">{p.name}</p>
                  <p className="text-sm text-muted">
                    From {formatUSD(p.price)} · {p.categoryName}
                  </p>
                </Link>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
