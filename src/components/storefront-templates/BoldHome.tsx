import Image from "next/image";
import Link from "next/link";
import { formatUSD } from "@/lib/format";
import type { StorefrontTemplateProps } from "./types";

const CHIP_COLORS = ["bg-terracotta", "bg-sage", "bg-gold", "bg-dark"];

// A dark, type-forward hero (no photo, unlike Classic/Modern) with the
// storefront banner demoted to a strip beneath it; solid-color category
// chips instead of photo tiles; large 2-up product cards with the price
// as a bold badge on the image.
export function BoldHome({
  plannerBusinessName,
  storefrontBannerUrl,
  categories,
  products,
  base,
  showProposalBuilder,
}: StorefrontTemplateProps) {
  const featured = products.slice(0, 4);

  return (
    <div>
      <section className="bg-dark text-cream-light">
        <div className="mx-auto max-w-7xl px-6 py-20 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-gold mb-5">{plannerBusinessName}</p>
          <h1 className="font-serif text-5xl md:text-7xl leading-[0.95] mb-8">
            Make it <span className="text-terracotta">unmistakably</span> yours.
          </h1>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href={`${base}/shop`}
              className="px-9 py-4 rounded-full bg-terracotta text-cream-light text-base font-semibold hover:bg-terracotta-dark transition-colors"
            >
              Shop products
            </Link>
            {showProposalBuilder && (
              <Link
                href={`${base}/builder`}
                className="px-9 py-4 rounded-full border border-cream-light/40 text-base font-semibold hover:bg-white/10 transition-colors"
              >
                Build my proposal
              </Link>
            )}
          </div>
        </div>
      </section>

      {storefrontBannerUrl && (
        <div className="relative h-56 md:h-72 w-full">
          <Image src={storefrontBannerUrl} alt="" fill className="object-cover" priority />
        </div>
      )}

      <section className="mx-auto max-w-7xl px-6 py-16">
        <h2 className="font-serif text-3xl mb-6">Shop by category</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
          {categories.map((cat, i) => (
            <Link
              key={cat.id}
              href={`${base}/shop?category=${cat.slug}`}
              className={`${CHIP_COLORS[i % CHIP_COLORS.length]} text-cream-light rounded-2xl h-28 flex items-center justify-center text-center px-3 font-serif text-lg hover:opacity-90 transition-opacity`}
            >
              {cat.name}
            </Link>
          ))}
        </div>

        {featured.length > 0 && (
          <>
            <h2 className="font-serif text-3xl mb-6">Best sellers</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              {featured.map((p) => (
                <Link key={p.id} href={`${base}/shop/${p.slug}`} className="group block">
                  <div className="relative aspect-[16/11] rounded-2xl overflow-hidden mb-4 bg-cream">
                    {p.image && (
                      <Image
                        src={p.image}
                        alt={p.name}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    )}
                    <span className="absolute top-4 left-4 px-4 py-2 rounded-full bg-dark text-cream-light text-sm font-semibold">
                      From {formatUSD(p.price)}
                    </span>
                  </div>
                  <p className="font-serif text-xl">{p.name}</p>
                  <p className="text-sm text-muted">{p.categoryName}</p>
                </Link>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
