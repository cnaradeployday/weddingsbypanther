"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { applyMarkup, formatUSD } from "@/lib/format";

export type PlannerProductRow = {
  id: string;
  productId: string;
  name: string;
  sku: string | null;
  categoryName: string;
  supplierName: string;
  factoryPrice: number;
  markupPct: number;
  enabled: boolean;
};

export function PlannerProductsTable({ rows: initialRows }: { rows: PlannerProductRow[] }) {
  const supabase = createClient();
  const [rows, setRows] = useState(initialRows);
  const [savingId, setSavingId] = useState<string | null>(null);

  const updateRow = (id: string, patch: Partial<PlannerProductRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const save = async (row: PlannerProductRow) => {
    setSavingId(row.id);
    await supabase
      .from("planner_products")
      .update({ markup_pct: row.markupPct, enabled: row.enabled })
      .eq("id", row.id);
    setSavingId(null);
  };

  return (
    <div className="rounded-xl border border-line bg-white overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-5 py-3 font-medium">Product</th>
            <th className="px-5 py-3 font-medium">Category</th>
            <th className="px-5 py-3 font-medium">Factory price</th>
            <th className="px-5 py-3 font-medium">Markup</th>
            <th className="px-5 py-3 font-medium">Final price</th>
            <th className="px-5 py-3 font-medium">Enabled</th>
            <th className="px-5 py-3 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-line last:border-0">
              <td className="px-5 py-4">
                <p className="font-medium">{row.name}</p>
                <p className="text-xs text-muted">
                  {row.sku ?? "—"} · {row.supplierName}
                </p>
              </td>
              <td className="px-5 py-4 text-muted">{row.categoryName}</td>
              <td className="px-5 py-4">{formatUSD(row.factoryPrice)}</td>
              <td className="px-5 py-4">
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={row.markupPct}
                    onChange={(e) => updateRow(row.id, { markupPct: Number(e.target.value) })}
                    className="w-16 rounded-md border border-line px-2 py-1"
                  />
                  <span className="text-muted">%</span>
                </div>
              </td>
              <td className="px-5 py-4 font-medium">
                {formatUSD(applyMarkup(row.factoryPrice, row.markupPct))}
              </td>
              <td className="px-5 py-4">
                <button
                  onClick={() => updateRow(row.id, { enabled: !row.enabled })}
                  className={`h-6 w-11 rounded-full transition-colors relative ${
                    row.enabled ? "bg-sage" : "bg-line"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                      row.enabled ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </td>
              <td className="px-5 py-4">
                <button
                  onClick={() => save(row)}
                  disabled={savingId === row.id}
                  className="text-xs text-terracotta font-medium disabled:opacity-50"
                >
                  {savingId === row.id ? "Saving…" : "Save"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
