import Image from "next/image";
import Link from "next/link";
import { formatUSD } from "@/lib/format";
import type { StorefrontTemplateProps } from "./types";

// A soft, luxury-boutique feel: a cream color block stands in for a
// second hero photo, thin gold rules frame the headline, categories read
// as a row of small ringed icons rather than tiles or pills, and
// product cards get generous spacing with a soft shadow instead of a
// hard border.
export function BoutiqueHome({
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
      <section className="mx-auto max-w-7xl px-6 pt-16 pb-20 grid md:grid-cols-2 gap-12 items-center">
        <div className="relative h-[380px] md:h-[460px] rounded-3xl overflow-hidden order-2 md:order-1">
          <Image
            src={storefrontBannerUrl || "/images/hero-tablescape.jpg"}
            alt=""
            fill
            className="object-cover"
            priority
          />
        </div>
        <div className="order-1 md:order-2 text-center md:text-left">
          <div className="w-10 h-px bg-gold mx-auto md:mx-0 mb-5" />
          <p className="text-xs uppercase tracking-[0.3em] text-gold mb-4">{plannerBusinessName}</p>
          <h1 className="font-serif text-4xl md:text-5xl italic leading-tight mb-6">
            An atelier for your
            <br />
            most considered details.
          </h1>
          <div className="flex items-center justify-center md:justify-start gap-4">
            <Link
              href={`${base}/shop`}
              className="px-8 py-3 rounded-full bg-dark text-cream-light text-sm font-medium hover:bg-dark-soft transition-colors"
            >
              Explore the atelier
            </Link>
            {showProposalBuilder && (
              <Link
                href={`${base}/builder`}
                className="px-8 py-3 rounded-full border border-gold text-sm font-medium text-dark hover:bg-cream transition-colors"
              >
                Build my proposal
              </Link>
            )}
          </div>
          <div className="w-10 h-px bg-gold mx-auto md:mx-0 mt-5" />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-20">
        <div className="flex flex-wrap justify-center gap-8 mb-16">
          {categories.map((cat) => (
            <Link key={cat.id} href={`${base}/shop?category=${cat.slug}`} className="flex flex-col items-center gap-2 group">
              <span className="h-16 w-16 rounded-full border border-gold flex items-center justify-center text-gold font-serif text-lg group-hover:bg-gold group-hover:text-cream-light transition-colors">
                {cat.name.charAt(0)}
              </span>
              <span className="text-xs font-medium">{cat.name}</span>
            </Link>
          ))}
        </div>

        {featured.length > 0 && (
          <>
            <h2 className="font-serif text-3xl text-center mb-10">Signature pieces</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {featured.map((p) => (
                <Link key={p.id} href={`${base}/shop/${p.slug}`} className="group block">
                  <div className="relative aspect-square rounded-2xl overflow-hidden mb-4 bg-cream shadow-[0_8px_30px_rgba(0,0,0,0.08)]">
                    {p.image && (
                      <Image
                        src={p.image}
                        alt={p.name}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    )}
                  </div>
                  <p className="font-serif text-base text-center">{p.name}</p>
                  <p className="text-xs text-muted text-center">From {formatUSD(p.price)}</p>
                </Link>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
