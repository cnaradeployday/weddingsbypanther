"use client";

import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/lib/cart";

export function StoreHeader({
  plannerSlug,
  businessName,
  subtitle,
  initials,
  logoUrl,
  showProposalBuilder = true,
}: {
  plannerSlug: string;
  businessName: string;
  subtitle: string;
  initials: string | null;
  logoUrl?: string | null;
  showProposalBuilder?: boolean;
}) {
  const { totalPieces } = useCart();
  const base = `/store/${plannerSlug}`;

  return (
    <header className="sticky top-0 z-40 bg-cream-light/95 backdrop-blur border-b border-line">
      <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between gap-6">
        <Link href={base} className="flex items-center gap-3 shrink-0">
          {logoUrl ? (
            <span className="relative flex h-9 w-9 items-center justify-center rounded-full overflow-hidden bg-dark">
              <Image src={logoUrl} alt="" fill className="object-cover" />
            </span>
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-dark text-cream-light text-xs font-serif tracking-wide">
              {initials ?? businessName.slice(0, 2).toUpperCase()}
            </span>
          )}
          <span className="leading-tight">
            <span className="block font-serif text-lg">{businessName}</span>
            <span className="block text-[10px] uppercase tracking-[0.18em] text-muted">
              {subtitle}
            </span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm text-dark/80">
          <Link href={`${base}/shop`} className="hover:text-terracotta transition-colors">
            Products
          </Link>
          {showProposalBuilder && (
            <Link href={`${base}/builder`} className="hover:text-terracotta transition-colors">
              Proposal Builder
            </Link>
          )}
          <Link href={base} className="hover:text-terracotta transition-colors">
            Our work
          </Link>
        </nav>

        <div className="flex items-center gap-6 text-sm shrink-0">
          <Link href={`${base}/cart`} className="hover:text-terracotta transition-colors">
            Cart · {totalPieces}
          </Link>
        </div>
      </div>
    </header>
  );
}
