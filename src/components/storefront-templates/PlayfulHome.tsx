import Image from "next/image";
import Link from "next/link";
import { formatUSD } from "@/lib/format";
import type { StorefrontTemplateProps } from "./types";

const CHIP_COLORS = ["bg-terracotta text-cream-light", "bg-gold text-dark", "bg-sage text-cream-light", "bg-dark text-cream-light"];
const ROTATIONS = ["-rotate-2", "rotate-1", "-rotate-1", "rotate-2"];

// An energetic, rounded-everything layout: the hero photo sits in a big
// floating bubble instead of a straight-edged banner, category pills
// vary in size and color instead of lining up in a grid, and product
// cards get a playful slight tilt that straightens out on hover.
export function PlayfulHome({
  plannerBusinessName,
  storefrontBannerUrl,
  categories,
  products,
  base,
  showProposalBuilder,
}: StorefrontTemplateProps) {
  const featured = products.slice(0, 4);

  return (
    <div className="bg-cream">
      <section className="mx-auto max-w-6xl px-6 pt-14 pb-16 text-center">
        <p className="text-xs uppercase tracking-[0.25em] text-terracotta mb-4">{plannerBusinessName}</p>
        <h1 className="font-serif text-4xl md:text-6xl leading-tight mb-8">
          Made to make you smile.
        </h1>
        <div className="relative h-[280px] md:h-[380px] max-w-2xl mx-auto rounded-[3rem] overflow-hidden rotate-1 shadow-xl mb-8">
          <Image
            src={storefrontBannerUrl || "/images/hero-tablescape.jpg"}
            alt=""
            fill
            className="object-cover"
            priority
          />
        </div>
        <div className="flex items-center justify-center gap-3">
          <Link
            href={`${base}/shop`}
            className="px-8 py-3 rounded-full bg-terracotta text-cream-light text-sm font-semibold hover:bg-terracotta-dark transition-colors"
          >
            Shop the fun stuff
          </Link>
          {showProposalBuilder && (
            <Link
              href={`${base}/builder`}
              className="px-8 py-3 rounded-full bg-cream-light border-2 border-dark text-sm font-semibold hover:bg-dark hover:text-cream-light transition-colors"
            >
              Build my proposal
            </Link>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="flex flex-wrap justify-center gap-3 mb-16">
          {categories.map((cat, i) => (
            <Link
              key={cat.id}
              href={`${base}/shop?category=${cat.slug}`}
              className={`${CHIP_COLORS[i % CHIP_COLORS.length]} px-6 py-3 rounded-full text-sm font-semibold hover:scale-105 transition-transform`}
            >
              {cat.name}
            </Link>
          ))}
        </div>

        {featured.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {featured.map((p, i) => (
              <Link key={p.id} href={`${base}/shop/${p.slug}`} className="group block">
                <div
                  className={`relative aspect-square rounded-[2rem] overflow-hidden mb-3 bg-cream-light shadow-md ${ROTATIONS[i % ROTATIONS.length]} group-hover:rotate-0 transition-transform duration-300`}
                >
                  {p.image && (
                    <Image src={p.image} alt={p.name} fill className="object-cover" />
                  )}
                </div>
                <p className="font-medium text-sm text-center">{p.name}</p>
                <p className="text-xs text-muted text-center">From {formatUSD(p.price)}</p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
