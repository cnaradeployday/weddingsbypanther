import Image from "next/image";
import Link from "next/link";
import { formatUSD } from "@/lib/format";
import type { StorefrontTemplateProps } from "./types";

// A big, cinematic hero (the photo fills the whole band, with a dark
// info bar docked to its bottom edge rather than text overlaid on top
// of it), oversized category cards instead of Classic's smaller tiles,
// and a horizontally-scrolling product carousel instead of a static
// grid.
export function ShowcaseHome({
  plannerBusinessName,
  storefrontBannerUrl,
  categories,
  categoryImages,
  products,
  base,
  showProposalBuilder,
}: StorefrontTemplateProps) {
  const featured = products.slice(0, 8);

  return (
    <div>
      <section className="relative">
        <div className="relative h-[55vh] min-h-[360px] w-full">
          <Image
            src={storefrontBannerUrl || "/images/hero-tablescape.jpg"}
            alt=""
            fill
            className="object-cover"
            priority
          />
        </div>
        <div className="bg-dark text-cream-light">
          <div className="mx-auto max-w-7xl px-6 py-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-gold mb-2">{plannerBusinessName}</p>
              <h1 className="font-serif text-3xl md:text-4xl">Crafted for the occasion.</h1>
            </div>
            <div className="flex gap-3 shrink-0">
              <Link
                href={`${base}/shop`}
                className="px-7 py-3 rounded-full bg-cream-light text-dark text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Shop now
              </Link>
              {showProposalBuilder && (
                <Link
                  href={`${base}/builder`}
                  className="px-7 py-3 rounded-full border border-cream-light/50 text-sm font-semibold hover:bg-white/10 transition-colors"
                >
                  Build my proposal
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid grid-cols-2 gap-5 mb-16">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`${base}/shop?category=${cat.slug}`}
              className="relative h-40 md:h-52 rounded-2xl overflow-hidden group"
            >
              <Image
                src={categoryImages[cat.slug] ?? "/images/hero-tablescape.jpg"}
                alt={cat.name}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <span className="absolute bottom-4 left-5 text-cream-light font-serif text-2xl">{cat.name}</span>
            </Link>
          ))}
        </div>

        {featured.length > 0 && (
          <>
            <h2 className="font-serif text-3xl mb-6">Fresh picks</h2>
            <div className="flex gap-5 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {featured.map((p) => (
                <Link key={p.id} href={`${base}/shop/${p.slug}`} className="group block shrink-0 w-48">
                  <div className="relative aspect-[3/4] rounded-xl overflow-hidden mb-3 bg-cream">
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
                  <p className="text-xs text-muted">From {formatUSD(p.price)}</p>
                </Link>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
