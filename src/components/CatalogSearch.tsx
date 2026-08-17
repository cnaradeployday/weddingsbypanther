"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { formatUSD } from "@/lib/format";
import type { CatalogProduct } from "@/lib/queries";

export function CatalogSearch({
  products,
  base,
}: {
  products: CatalogProduct[];
  base: string;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q) ||
        p.categoryName.toLowerCase().includes(q)
    );
  }, [products, query]);

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-4">
        <p className="text-sm text-muted">{filtered.length} products</p>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${products.length} products`}
          className="w-full max-w-xs rounded-full border border-line px-4 py-2 text-sm focus:outline-none focus:border-dark"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-muted text-sm py-10 text-center">No products match &quot;{query}&quot;.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-10">
          {filtered.map((p) => (
            <Link key={p.id} href={`${base}/shop/${p.slug}`} className="group">
              <div className="relative aspect-square rounded-xl overflow-hidden mb-3 bg-cream">
                {p.image && (
                  <Image
                    src={p.image}
                    alt={p.name}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                )}
                <span className="absolute top-3 left-3 text-[10px] uppercase tracking-wide bg-cream-light/90 px-2 py-1 rounded-full">
                  {p.categoryName}
                </span>
              </div>
              <p className="font-medium text-sm">{p.name}</p>
              <p className="text-sm text-muted">
                From {formatUSD(p.price)} · min {p.minOrder}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
