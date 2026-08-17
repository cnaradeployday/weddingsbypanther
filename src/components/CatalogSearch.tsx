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
  const [showFilters, setShowFilters] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [maxMinOrder, setMaxMinOrder] = useState("");
  const [personalizableOnly, setPersonalizableOnly] = useState(false);

  const activeFilterCount =
    (minPrice ? 1 : 0) + (maxPrice ? 1 : 0) + (maxMinOrder ? 1 : 0) + (personalizableOnly ? 1 : 0);

  const clearFilters = () => {
    setMinPrice("");
    setMaxPrice("");
    setMaxMinOrder("");
    setPersonalizableOnly(false);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const min = minPrice ? Number(minPrice) : null;
    const max = maxPrice ? Number(maxPrice) : null;
    const maxOrder = maxMinOrder ? Number(maxMinOrder) : null;

    return products.filter((p) => {
      if (q) {
        const matchesText =
          p.name.toLowerCase().includes(q) ||
          (p.description ?? "").toLowerCase().includes(q) ||
          p.categoryName.toLowerCase().includes(q);
        if (!matchesText) return false;
      }
      if (min !== null && p.price < min) return false;
      if (max !== null && p.price > max) return false;
      if (maxOrder !== null && p.minOrder > maxOrder) return false;
      if (personalizableOnly && !p.personalizable) return false;
      return true;
    });
  }, [products, query, minPrice, maxPrice, maxMinOrder, personalizableOnly]);

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <p className="text-sm text-muted">{filtered.length} products</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowFilters((s) => !s)}
            className={`text-sm px-4 py-2 rounded-full border ${
              activeFilterCount > 0 ? "border-terracotta text-terracotta-dark" : "border-line text-dark/80"
            }`}
          >
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          </button>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${products.length} products`}
            className="w-full max-w-xs rounded-full border border-line px-4 py-2 text-sm focus:outline-none focus:border-dark"
          />
        </div>
      </div>

      {showFilters && (
        <div className="rounded-xl border border-line bg-cream p-5 mb-6 grid sm:grid-cols-4 gap-4 items-end">
          <div>
            <label className="text-xs uppercase tracking-wide text-muted block mb-1">Min price</label>
            <input
              type="number"
              min={0}
              placeholder="$0"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm bg-white focus:outline-none focus:border-dark"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-muted block mb-1">Max price</label>
            <input
              type="number"
              min={0}
              placeholder="Any"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm bg-white focus:outline-none focus:border-dark"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-muted block mb-1">Max min. order</label>
            <input
              type="number"
              min={0}
              placeholder="Any"
              value={maxMinOrder}
              onChange={(e) => setMaxMinOrder(e.target.value)}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm bg-white focus:outline-none focus:border-dark"
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={personalizableOnly}
                onChange={(e) => setPersonalizableOnly(e.target.checked)}
              />
              Personalizable
            </label>
            {activeFilterCount > 0 && (
              <button type="button" onClick={clearFilters} className="text-xs text-terracotta-dark whitespace-nowrap">
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-muted text-sm py-10 text-center">
          No products match {query ? `"${query}"` : "these filters"}.
        </p>
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
