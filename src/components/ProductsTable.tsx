"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatUSD } from "@/lib/format";

const STATUS_STYLE: Record<string, string> = {
  approved: "bg-sage/15 text-sage",
  pending: "bg-gold/20 text-dark",
  rejected: "bg-terracotta/15 text-terracotta-dark",
  draft: "bg-line text-muted",
};

export type ProductRow = {
  id: string;
  name: string;
  sku: string | null;
  factory_price: number;
  status: string;
  supplier: { business_name: string } | null;
  category: { name: string } | null;
};

type SortKey = "name" | "supplier" | "category" | "factory_price" | "status";

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="10"
      height="10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`inline-block ml-1 transition-transform ${active && dir === "desc" ? "rotate-180" : ""} ${
        active ? "opacity-100" : "opacity-30"
      }`}
    >
      <path d="M3 6 L8 11 L13 6" />
    </svg>
  );
}

// Client-side sort/search/filter for an admin product listing — the row
// count here (dozens, not thousands) makes a server round-trip per
// interaction unnecessary; everything works off the single already-fetched
// list.
export function ProductsTable({ products, canWrite }: { products: ProductRow[]; canWrite: boolean }) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.category?.name).filter((n): n is string => !!n))).sort(),
    [products]
  );
  const statuses = useMemo(() => Array.from(new Set(products.map((p) => p.status))).sort(), [products]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = products.filter((p) => {
      if (categoryFilter && p.category?.name !== categoryFilter) return false;
      if (statusFilter && p.status !== statusFilter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.sku ?? "").toLowerCase().includes(q) ||
        (p.supplier?.business_name ?? "").toLowerCase().includes(q) ||
        (p.category?.name ?? "").toLowerCase().includes(q)
      );
    });
    const sign = sortDir === "asc" ? 1 : -1;
    return filtered.slice().sort((a, b) => {
      switch (sortKey) {
        case "factory_price":
          return (a.factory_price - b.factory_price) * sign;
        case "supplier":
          return (a.supplier?.business_name ?? "").localeCompare(b.supplier?.business_name ?? "") * sign;
        case "category":
          return (a.category?.name ?? "").localeCompare(b.category?.name ?? "") * sign;
        case "status":
          return a.status.localeCompare(b.status) * sign;
        default:
          return a.name.localeCompare(b.name) * sign;
      }
    });
  }, [products, search, categoryFilter, statusFilter, sortKey, sortDir]);

  const th = (key: SortKey, label: string) => (
    <th className="px-5 py-3 font-medium">
      <button
        type="button"
        onClick={() => toggleSort(key)}
        className="flex items-center hover:text-dark"
      >
        {label}
        <SortIcon active={sortKey === key} dir={sortDir} />
      </button>
    </th>
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="search"
          placeholder="Search by name, SKU, supplier, category…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[220px] rounded-lg border border-line px-4 py-2.5 text-sm focus:outline-none focus:border-dark"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-line px-3 py-2.5 text-sm bg-white"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-line px-3 py-2.5 text-sm bg-white capitalize"
        >
          <option value="">All statuses</option>
          {statuses.map((s) => (
            <option key={s} value={s} className="capitalize">
              {s}
            </option>
          ))}
        </select>
        {(search || categoryFilter || statusFilter) && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setCategoryFilter("");
              setStatusFilter("");
            }}
            className="text-xs text-terracotta-dark font-medium"
          >
            Clear
          </button>
        )}
      </div>

      <div className="rounded-xl border border-line bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              {th("name", "Product")}
              {th("supplier", "Supplier")}
              {th("category", "Category")}
              {th("factory_price", "Factory price")}
              {th("status", "Status")}
              <th className="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-b border-line last:border-0">
                <td className="px-5 py-4">
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-muted">{p.sku}</p>
                </td>
                <td className="px-5 py-4 text-muted">{p.supplier?.business_name}</td>
                <td className="px-5 py-4 text-muted">{p.category?.name}</td>
                <td className="px-5 py-4">{formatUSD(p.factory_price)}</td>
                <td className="px-5 py-4">
                  <span className={`text-xs px-2.5 py-1 rounded-full capitalize ${STATUS_STYLE[p.status]}`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-5 py-4">
                  {canWrite && (
                    <Link href={`/admin/products/${p.id}/edit`} className="text-terracotta text-sm font-medium">
                      Edit
                    </Link>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-muted">
                  No products match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
