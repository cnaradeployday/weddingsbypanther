import Image from "next/image";
import Link from "next/link";
import { formatUSD } from "@/lib/format";
import type { StorefrontTemplateProps } from "./types";

// A strict, Swiss-grid-inspired layout: the hero splits into equal
// thirds with hard vertical rules, the category index runs as one row
// of evenly divided columns, and the product grid is dense and uniform
// with the price set as a small overline above the name instead of
// underneath.
export function GridHome({
  plannerBusinessName,
  storefrontBannerUrl,
  categories,
  products,
  base,
  showProposalBuilder,
}: StorefrontTemplateProps) {
  const featured = products.slice(0, 8);

  return (
    <div>
      <section className="grid md:grid-cols-3 border-b border-dark">
        <div className="relative h-56 md:h-72 border-b md:border-b-0 md:border-r border-dark">
          <Image
            src={storefrontBannerUrl || "/images/hero-tablescape.jpg"}
            alt=""
            fill
            className="object-cover grayscale"
          />
        </div>
        <div className="p-8 border-b md:border-b-0 md:border-r border-dark flex flex-col justify-center">
          <p className="text-xs uppercase tracking-[0.2em] text-muted mb-3">{plannerBusinessName}</p>
          <h1 className="font-sans text-3xl md:text-4xl font-semibold leading-none">
            Function. Form. You.
          </h1>
        </div>
        <div className="p-8 flex flex-col justify-center gap-3">
          <Link
            href={`${base}/shop`}
            className="text-sm font-semibold uppercase tracking-wide flex items-center justify-between border-b border-dark pb-2 hover:text-terracotta transition-colors"
          >
            Browse products <span>→</span>
          </Link>
          {showProposalBuilder && (
            <Link
              href={`${base}/builder`}
              className="text-sm font-semibold uppercase tracking-wide flex items-center justify-between hover:text-terracotta transition-colors"
            >
              Build my proposal <span>→</span>
            </Link>
          )}
        </div>
      </section>

      <section className="grid grid-cols-2 md:flex border-b border-dark overflow-x-auto">
        {categories.map((cat) => (
          <Link
            key={cat.id}
            href={`${base}/shop?category=${cat.slug}`}
            className="px-6 py-4 text-sm font-medium border-r border-b md:border-b-0 border-dark hover:bg-cream transition-colors shrink-0 text-center md:text-left"
          >
            {cat.name}
          </Link>
        ))}
      </section>

      {featured.length > 0 && (
        <section className="grid grid-cols-2 md:grid-cols-4">
          {featured.map((p) => (
            <Link
              key={p.id}
              href={`${base}/shop/${p.slug}`}
              className="group border-r border-b border-line p-5 hover:bg-cream transition-colors"
            >
              <div className="relative aspect-square mb-4 bg-cream overflow-hidden">
                {p.image && (
                  <Image
                    src={p.image}
                    alt={p.name}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                )}
              </div>
              <p className="text-[11px] uppercase tracking-wide text-terracotta mb-1">From {formatUSD(p.price)}</p>
              <p className="text-sm font-medium">{p.name}</p>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
