import Image from "next/image";
import Link from "next/link";
import { formatUSD } from "@/lib/format";
import type { StorefrontTemplateProps } from "./types";

// The original (and still default) storefront layout — side-by-side
// hero, two action cards, image category tiles, a flat featured grid.
export function ClassicHome({
  plannerBusinessName,
  storefrontBannerUrl,
  categories,
  categoryImages,
  products,
  base,
  showProposalBuilder,
}: StorefrontTemplateProps) {
  const featured = products.slice(0, 4);

  return (
    <div>
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-6 pt-16 pb-20 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-terracotta mb-4">
              Curated by {plannerBusinessName}
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
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={`${base}/shop`}
                className="px-10 py-6 md:px-24 md:py-12 rounded-full bg-terracotta text-cream-light text-xl md:text-4xl font-medium hover:bg-terracotta-dark transition-colors"
              >
                Browse Products
              </Link>
              {showProposalBuilder && (
                <Link
                  href={`${base}/builder`}
                  className="px-6 py-3 rounded-full border border-dark/20 text-sm font-medium hover:border-dark transition-colors"
                >
                  Build My Proposal
                </Link>
              )}
            </div>
          </div>
          <div className="relative h-[420px] rounded-2xl overflow-hidden">
            <Image
              src={storefrontBannerUrl || "/images/hero-tablescape.jpg"}
              alt="Wedding tablescape"
              fill
              className="object-cover"
              priority
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-20">
        <div className={`grid gap-6 mb-14 ${showProposalBuilder ? "md:grid-cols-2" : ""}`}>
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
          {showProposalBuilder && (
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
          )}
        </div>

        <h2 className="font-serif text-3xl mb-6">Shop by category</h2>
        <div className="grid grid-cols-2 gap-4 mb-16">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`${base}/shop?category=${cat.slug}`}
              className="relative h-48 sm:h-64 md:h-72 rounded-xl overflow-hidden group"
            >
              <Image
                src={categoryImages[cat.slug] ?? "/images/hero-tablescape.jpg"}
                alt={cat.name}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              <span className="absolute bottom-4 left-5 text-cream-light font-serif text-xl md:text-2xl">
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
