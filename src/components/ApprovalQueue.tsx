"use client";

import { useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { formatUSD } from "@/lib/format";

export type PendingProduct = {
  id: string;
  name: string;
  description: string | null;
  sku: string | null;
  factoryPrice: number;
  minOrder: number;
  leadTimeMin: number;
  leadTimeMax: number;
  categoryName: string;
  supplierName: string;
  images: string[];
  techniques: string[];
};

export function ApprovalQueue({ products: initial }: { products: PendingProduct[] }) {
  const supabase = createClient();
  const [products, setProducts] = useState(initial);
  const [selectedId, setSelectedId] = useState(initial[0]?.id ?? null);
  const [note, setNote] = useState("");
  const [working, setWorking] = useState(false);

  const selected = products.find((p) => p.id === selectedId) ?? null;

  const resolve = async (status: "approved" | "rejected" | "draft") => {
    if (!selected) return;
    if (status === "draft" && !note.trim()) {
      alert("Add a note explaining what needs to change before sending it back.");
      return;
    }
    setWorking(true);
    await supabase
      .from("products")
      .update({ status, reviewer_note: note || null })
      .eq("id", selected.id);
    setWorking(false);
    const remaining = products.filter((p) => p.id !== selected.id);
    setProducts(remaining);
    setSelectedId(remaining[0]?.id ?? null);
    setNote("");
  };

  if (products.length === 0) {
    return <p className="text-muted">Nothing waiting for review — the queue is clear.</p>;
  }

  return (
    <div className="grid md:grid-cols-[320px_1fr] gap-6">
      <div className="rounded-xl border border-line bg-white overflow-hidden divide-y divide-line max-h-[70vh] overflow-y-auto">
        {products.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelectedId(p.id)}
            className={`w-full text-left px-4 py-4 ${p.id === selectedId ? "bg-cream" : "hover:bg-cream/50"}`}
          >
            <p className="font-medium text-sm">{p.name}</p>
            <p className="text-xs text-muted">
              {p.supplierName} · {p.categoryName}
            </p>
          </button>
        ))}
      </div>

      {selected && (
        <div className="rounded-xl border border-line bg-white p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="font-serif text-2xl">{selected.name}</h2>
              <p className="text-sm text-muted">
                {selected.supplierName} · {selected.categoryName}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => resolve("rejected")}
                disabled={working}
                className="px-4 py-2 rounded-full border border-terracotta text-terracotta text-sm font-medium disabled:opacity-50"
              >
                Reject
              </button>
              <button
                onClick={() => resolve("draft")}
                disabled={working}
                className="px-4 py-2 rounded-full border border-line text-dark text-sm font-medium disabled:opacity-50"
              >
                Request changes
              </button>
              <button
                onClick={() => resolve("approved")}
                disabled={working}
                className="px-4 py-2 rounded-full bg-sage text-cream-light text-sm font-medium disabled:opacity-50"
              >
                Approve
              </button>
            </div>
          </div>

          {selected.images[0] && (
            <div className="relative h-64 rounded-lg overflow-hidden mb-6 bg-cream">
              <Image src={selected.images[0]} alt={selected.name} fill className="object-cover" />
            </div>
          )}

          <p className="text-sm text-dark/80 mb-6">{selected.description}</p>

          <div className="grid grid-cols-2 gap-4 text-sm mb-6">
            <div className="rounded-lg bg-cream p-4">
              <p className="text-xs text-muted mb-1">Factory price</p>
              <p className="font-medium">{formatUSD(selected.factoryPrice)}</p>
            </div>
            <div className="rounded-lg bg-cream p-4">
              <p className="text-xs text-muted mb-1">Min order</p>
              <p className="font-medium">{selected.minOrder}</p>
            </div>
            <div className="rounded-lg bg-cream p-4">
              <p className="text-xs text-muted mb-1">Lead time</p>
              <p className="font-medium">
                {selected.leadTimeMin}–{selected.leadTimeMax} days
              </p>
            </div>
            <div className="rounded-lg bg-cream p-4">
              <p className="text-xs text-muted mb-1">Techniques</p>
              <p className="font-medium">{selected.techniques.join(", ") || "—"}</p>
            </div>
          </div>

          <label className="text-xs uppercase tracking-wide text-muted block mb-2">
            Reviewer note (visible to supplier — required for &quot;Request changes&quot;)
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark"
          />
        </div>
      )}
    </div>
  );
}
