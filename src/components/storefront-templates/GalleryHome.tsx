import Image from "next/image";
import Link from "next/link";
import { formatUSD } from "@/lib/format";
import type { StorefrontTemplateProps } from "./types";

// A nearly full-viewport photo with only a small centered mark overlaid
// (no headline copy competing with the image), then a sidebar-plus-
// masonry layout below — categories as a vertical list, products at
// varying heights like pieces on a gallery wall.
export function GalleryHome({
  plannerBusinessName,
  storefrontBannerUrl,
  categories,
  products,
  base,
  showProposalBuilder,
}: StorefrontTemplateProps) {
  const featured = products.slice(0, 6);
  const heights = ["aspect-[3/4]", "aspect-square", "aspect-[4/5]"];

  return (
    <div>
      <section className="relative h-[70vh] min-h-[420px] overflow-hidden">
        <Image
          src={storefrontBannerUrl || "/images/hero-tablescape.jpg"}
          alt=""
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-black/25" />
        <div className="relative h-full flex flex-col items-center justify-center text-center text-cream-light px-6">
          <p className="font-serif text-2xl md:text-3xl tracking-wide mb-6">{plannerBusinessName}</p>
          <div className="flex items-center gap-4">
            <Link
              href={`${base}/shop`}
              className="px-7 py-2.5 rounded-full border border-cream-light text-sm hover:bg-cream-light hover:text-dark transition-colors"
            >
              Enter the shop
            </Link>
            {showProposalBuilder && (
              <Link
                href={`${base}/builder`}
                className="px-7 py-2.5 rounded-full border border-cream-light/50 text-sm hover:bg-white/10 transition-colors"
              >
                Build my proposal
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16 grid md:grid-cols-[160px_1fr] gap-10">
        <div className="flex md:flex-col flex-wrap gap-x-6 gap-y-3 md:sticky md:top-20 self-start">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`${base}/shop?category=${cat.slug}`}
              className="text-sm font-medium text-muted hover:text-dark transition-colors"
            >
              {cat.name}
            </Link>
          ))}
        </div>

        {featured.length > 0 && (
          <div className="columns-2 md:columns-3 gap-5 [&>*]:mb-5 [&>*]:break-inside-avoid">
            {featured.map((p, i) => (
              <Link key={p.id} href={`${base}/shop/${p.slug}`} className="group block">
                <div className={`relative ${heights[i % heights.length]} rounded-md overflow-hidden mb-2 bg-cream`}>
                  {p.image && (
                    <Image
                      src={p.image}
                      alt={p.name}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  )}
                </div>
                <p className="text-sm font-medium">{p.name}</p>
                <p className="text-xs text-muted">From {formatUSD(p.price)}</p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
