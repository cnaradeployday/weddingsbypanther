import Image from "next/image";
import Link from "next/link";
import { formatUSD } from "@/lib/format";
import type { StorefrontTemplateProps } from "./types";

// A magazine-style layout: a two-column masthead instead of a hero
// photo, a numbered category index, and an asymmetric "lookbook" pairing
// of one large and two small product photos.
export function EditorialHome({
  plannerBusinessName,
  storefrontBannerUrl,
  categories,
  products,
  base,
  showProposalBuilder,
}: StorefrontTemplateProps) {
  const [lead, ...rest] = products;
  const secondary = rest.slice(0, 4);

  return (
    <div className="mx-auto max-w-6xl px-6 py-14">
      <div className="grid md:grid-cols-[1fr_auto] gap-8 items-end pb-8 border-b-2 border-dark mb-10">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-terracotta mb-3">{plannerBusinessName}</p>
          <h1 className="font-serif text-5xl md:text-7xl leading-[0.95]">
            The Collection
          </h1>
        </div>
        <div className="flex gap-3 shrink-0">
          <Link
            href={`${base}/shop`}
            className="px-6 py-3 rounded-full bg-dark text-cream-light text-sm font-medium hover:bg-dark-soft transition-colors"
          >
            Browse Products
          </Link>
          {showProposalBuilder && (
            <Link
              href={`${base}/builder`}
              className="px-6 py-3 rounded-full border border-dark text-sm font-medium hover:bg-cream transition-colors"
            >
              Build My Proposal
            </Link>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-[180px_1fr] gap-10 mb-16">
        <ol className="space-y-3">
          {categories.map((cat, i) => (
            <li key={cat.id}>
              <Link
                href={`${base}/shop?category=${cat.slug}`}
                className="flex items-baseline gap-2 group"
              >
                <span className="font-serif text-sm text-muted">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-sm font-medium group-hover:text-terracotta transition-colors">
                  {cat.name}
                </span>
              </Link>
            </li>
          ))}
        </ol>

        {lead && (
          <div className="grid sm:grid-cols-2 gap-6">
            <Link href={`${base}/shop/${lead.slug}`} className="group sm:row-span-2">
              <div className="relative aspect-[4/5] rounded-sm overflow-hidden mb-3 bg-cream">
                {lead.image && (
                  <Image
                    src={lead.image}
                    alt={lead.name}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                )}
              </div>
              <p className="font-serif text-xl">{lead.name}</p>
              <p className="text-sm text-muted">From {formatUSD(lead.price)}</p>
            </Link>
            <div className="grid grid-cols-2 gap-4 sm:self-start">
              {secondary.slice(0, 4).map((p) => (
                <Link key={p.id} href={`${base}/shop/${p.slug}`} className="group">
                  <div className="relative aspect-square rounded-sm overflow-hidden mb-2 bg-cream">
                    {p.image && (
                      <Image
                        src={p.image}
                        alt={p.name}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    )}
                  </div>
                  <p className="text-xs font-medium leading-snug">{p.name}</p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {storefrontBannerUrl && (
        <div className="relative h-72 md:h-96 rounded-sm overflow-hidden mb-4">
          <Image src={storefrontBannerUrl} alt="" fill className="object-cover" priority />
        </div>
      )}
      <p className="text-xs uppercase tracking-[0.2em] text-muted text-center">
        {products.length} pieces, personalized in our studio
      </p>
    </div>
  );
}
