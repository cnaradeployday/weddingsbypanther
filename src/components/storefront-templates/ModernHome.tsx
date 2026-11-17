import Image from "next/image";
import Link from "next/link";
import { formatUSD } from "@/lib/format";
import type { StorefrontTemplateProps } from "./types";

// A full-bleed, text-overlaid hero instead of Classic's side-by-side
// layout; category pills in a scrolling row instead of image tiles; a
// 3-up product grid with the price as a badge on the photo instead of
// text underneath.
export function ModernHome({
  plannerBusinessName,
  storefrontBannerUrl,
  categories,
  products,
  base,
  showProposalBuilder,
}: StorefrontTemplateProps) {
  const featured = products.slice(0, 6);

  return (
    <div>
      <section className="relative h-[460px] md:h-[560px] overflow-hidden">
        <Image
          src={storefrontBannerUrl || "/images/hero-tablescape.jpg"}
          alt=""
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/10" />
        <div className="relative h-full flex flex-col items-center justify-end text-center px-6 pb-16 text-cream-light">
          <p className="text-xs uppercase tracking-[0.3em] mb-3 opacity-80">{plannerBusinessName}</p>
          <h1 className="font-sans text-4xl md:text-6xl font-semibold leading-tight mb-6 max-w-2xl">
            Everything you need, made yours.
          </h1>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href={`${base}/shop`}
              className="px-8 py-3 rounded-full bg-cream-light text-dark text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Shop the catalog
            </Link>
            {showProposalBuilder && (
              <Link
                href={`${base}/builder`}
                className="px-8 py-3 rounded-full border border-cream-light/60 text-sm font-semibold hover:bg-white/10 transition-colors"
              >
                Build my proposal
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-14">
        <div className="flex items-center gap-3 overflow-x-auto pb-2 mb-14 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <span className="text-xs uppercase tracking-wide text-muted shrink-0">Shop by category</span>
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`${base}/shop?category=${cat.slug}`}
              className="shrink-0 px-5 py-2.5 rounded-full border border-line text-sm font-medium hover:border-dark hover:bg-cream transition-colors"
            >
              {cat.name}
            </Link>
          ))}
        </div>

        {featured.length > 0 && (
          <>
            <h2 className="font-sans text-2xl font-semibold mb-6">Popular picks</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
              {featured.map((p) => (
                <Link key={p.id} href={`${base}/shop/${p.slug}`} className="group block">
                  <div className="relative aspect-[4/5] rounded-2xl overflow-hidden mb-0 bg-cream">
                    {p.image && (
                      <Image
                        src={p.image}
                        alt={p.name}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    )}
                    <span className="absolute bottom-3 left-3 px-3 py-1 rounded-full bg-white/90 text-xs font-semibold">
                      From {formatUSD(p.price)}
                    </span>
                  </div>
                  <p className="font-medium text-sm mt-3">{p.name}</p>
                  <p className="text-xs text-muted">{p.categoryName}</p>
                </Link>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
