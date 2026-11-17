import Image from "next/image";
import Link from "next/link";
import { formatUSD } from "@/lib/format";
import type { StorefrontTemplateProps } from "./types";

// Deliberately spare: no hero photo at all, a centered light headline on
// plain cream, category names as plain underlined text links, and a
// tight, caption-only product grid — the opposite instinct from
// Classic/Modern/Bold's photo-forward heroes.
export function MinimalHome({
  plannerBusinessName,
  categories,
  products,
  base,
  showProposalBuilder,
}: StorefrontTemplateProps) {
  const featured = products.slice(0, 8);

  return (
    <div className="mx-auto max-w-4xl px-6 py-20 md:py-28">
      <div className="text-center mb-16">
        <p className="text-xs uppercase tracking-[0.35em] text-muted mb-5">{plannerBusinessName}</p>
        <h1 className="font-sans text-3xl md:text-4xl font-light tracking-tight mb-8">
          A small, considered collection.
        </h1>
        <div className="flex items-center justify-center gap-6 text-sm">
          <Link href={`${base}/shop`} className="underline underline-offset-4 hover:text-terracotta transition-colors">
            Browse products
          </Link>
          {showProposalBuilder && (
            <Link href={`${base}/builder`} className="underline underline-offset-4 hover:text-terracotta transition-colors">
              Build my proposal
            </Link>
          )}
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mb-20 text-sm">
        {categories.map((cat, i) => (
          <span key={cat.id} className="flex items-center gap-6">
            <Link
              href={`${base}/shop?category=${cat.slug}`}
              className="text-muted hover:text-dark transition-colors"
            >
              {cat.name}
            </Link>
            {i < categories.length - 1 && <span className="text-line">/</span>}
          </span>
        ))}
      </div>

      {featured.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-10">
          {featured.map((p) => (
            <Link key={p.id} href={`${base}/shop/${p.slug}`} className="group block text-center">
              <div className="relative aspect-square mb-3 bg-cream">
                {p.image && (
                  <Image
                    src={p.image}
                    alt={p.name}
                    fill
                    className="object-cover transition-opacity duration-300 group-hover:opacity-80"
                  />
                )}
              </div>
              <p className="text-xs font-medium">{p.name}</p>
              <p className="text-xs text-muted">{formatUSD(p.price)}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
