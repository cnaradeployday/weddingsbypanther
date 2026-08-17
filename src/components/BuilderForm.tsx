"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import type { CatalogProduct } from "@/lib/queries";

const STYLES = ["Romantic", "Minimalist", "Rustic", "Modern", "Classic"];

type Tier = {
  label: string;
  tier: "under" | "fit" | "premium";
  items: { product: CatalogProduct; quantity: number }[];
  total: number;
};

function guestTables(guests: number) {
  return Math.max(1, Math.ceil(guests / 10));
}

function buildTier(
  catalog: CatalogProduct[],
  guests: number,
  pick: (products: CatalogProduct[]) => CatalogProduct | undefined
): { product: CatalogProduct; quantity: number }[] {
  const byCategory = new Map<string, CatalogProduct[]>();
  for (const p of catalog) {
    const list = byCategory.get(p.categorySlug) ?? [];
    list.push(p);
    byCategory.set(p.categorySlug, list);
  }

  const plan: { slug: string; qty: number }[] = [
    { slug: "wedding-favors", qty: guests },
    { slug: "centerpieces", qty: guestTables(guests) },
    { slug: "place-cards", qty: guests },
    { slug: "table-numbers", qty: guestTables(guests) },
    { slug: "welcome-bags", qty: Math.ceil(guests * 0.6) },
  ];

  const items: { product: CatalogProduct; quantity: number }[] = [];
  for (const { slug, qty } of plan) {
    const options = (byCategory.get(slug) ?? []).slice().sort((a, b) => a.price - b.price);
    const chosen = pick(options);
    if (chosen) items.push({ product: chosen, quantity: Math.max(qty, chosen.minOrder) });
  }
  return items;
}

export function BuilderForm({
  plannerId,
  plannerSlug,
  catalog,
}: {
  plannerId: string;
  plannerSlug: string;
  catalog: CatalogProduct[];
}) {
  const router = useRouter();
  const [budget, setBudget] = useState(3500);
  const [guests, setGuests] = useState(120);
  const [styles, setStyles] = useState<string[]>(["Romantic", "Rustic"]);
  const [submitting, setSubmitting] = useState(false);

  const toggleStyle = (style: string) => {
    setStyles((prev) =>
      prev.includes(style)
        ? prev.filter((s) => s !== style)
        : prev.length >= 3
        ? prev
        : [...prev, style]
    );
  };

  const handleGenerate = async () => {
    setSubmitting(true);

    const cheap = buildTier(catalog, guests, (opts) => opts[0]);
    const mid = buildTier(catalog, guests, (opts) => opts[Math.floor(opts.length / 2)] ?? opts[0]);
    const premium = buildTier(catalog, guests, (opts) => opts[opts.length - 1]);

    const totalOf = (items: { product: CatalogProduct; quantity: number }[]) =>
      items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);

    const tiers: Tier[] = [
      { label: "The Quiet Set", tier: "under", items: cheap, total: totalOf(cheap) },
      { label: "The Signature Set", tier: "fit", items: mid, total: totalOf(mid) },
      { label: "The Gilded Evening", tier: "premium", items: premium, total: totalOf(premium) },
    ];

    const { data: proposal, error: proposalError } = await supabase
      .from("proposals")
      .insert({
        planner_id: plannerId,
        budget,
        guest_count: guests,
        style_preferences: styles,
      })
      .select()
      .single();

    if (proposalError || !proposal) {
      setSubmitting(false);
      return;
    }

    for (let i = 0; i < tiers.length; i++) {
      const t = tiers[i];
      const { data: option, error: optionError } = await supabase
        .from("proposal_options")
        .insert({
          proposal_id: proposal.id,
          label: t.label,
          tier: t.tier,
          total_price: t.total,
          sort_order: i,
        })
        .select()
        .single();

      if (optionError || !option) continue;

      await supabase.from("proposal_option_items").insert(
        t.items.map((i) => ({
          proposal_option_id: option.id,
          product_id: i.product.id,
          quantity: i.quantity,
          unit_price: i.product.price,
        }))
      );
    }

    router.push(`/store/${plannerSlug}/proposals/${proposal.id}`);
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <div className="rounded-2xl bg-dark text-cream-light grid md:grid-cols-2 overflow-hidden">
        <div className="p-10 md:p-14">
          <p className="text-xs uppercase tracking-[0.2em] text-gold mb-6">Step 1 of 2</p>
          <h1 className="font-serif text-4xl mb-3">
            Let&apos;s shape
            <br />
            <em className="italic">your day.</em>
          </h1>
          <p className="text-cream-light/70 mb-8 max-w-md">
            Two numbers and a mood — we&apos;ll compose complete sets of pieces that fit,
            from favors to the last place card.
          </p>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-white/5 rounded-xl p-4">
              <label className="text-xs uppercase tracking-wide text-cream-light/60 block mb-1">
                Total budget
              </label>
              <div className="flex items-center gap-1">
                <span>$</span>
                <input
                  type="number"
                  value={budget}
                  onChange={(e) => setBudget(Number(e.target.value))}
                  className="bg-transparent text-2xl font-serif w-full focus:outline-none"
                />
              </div>
            </div>
            <div className="bg-white/5 rounded-xl p-4">
              <label className="text-xs uppercase tracking-wide text-cream-light/60 block mb-1">
                Number of guests
              </label>
              <div className="flex items-center justify-between">
                <input
                  type="number"
                  value={guests}
                  onChange={(e) => setGuests(Number(e.target.value))}
                  className="bg-transparent text-2xl font-serif w-16 focus:outline-none"
                />
                <div className="flex gap-2">
                  <button onClick={() => setGuests((g) => Math.max(10, g - 10))} className="h-7 w-7 rounded-full border border-white/30">−</button>
                  <button onClick={() => setGuests((g) => g + 10)} className="h-7 w-7 rounded-full border border-white/30">+</button>
                </div>
              </div>
            </div>
          </div>

          <label className="text-xs uppercase tracking-wide text-cream-light/60 block mb-3">
            Style preference
          </label>
          <div className="flex flex-wrap gap-2 mb-4">
            {STYLES.map((s) => (
              <button
                key={s}
                onClick={() => toggleStyle(s)}
                className={`px-4 py-2 rounded-full text-sm border ${
                  styles.includes(s)
                    ? "bg-gold text-dark border-gold"
                    : "border-white/30 text-cream-light/80"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <p className="text-xs text-cream-light/50 mb-8">
            Pick up to three — they steer materials and palette.
          </p>

          <button
            onClick={handleGenerate}
            disabled={submitting}
            className="px-6 py-3 rounded-full bg-cream-light text-dark text-sm font-medium hover:bg-white transition-colors disabled:opacity-50"
          >
            {submitting ? "Generating…" : "Generate My Proposal"}
          </button>
          <span className="ml-4 text-xs text-cream-light/50">Takes about 20 seconds · nothing is charged</span>
        </div>
        <div className="relative min-h-[280px]">
          <Image
            src="/images/stationery-minimal-black.jpg"
            alt="Wedding invitation"
            fill
            className="object-cover"
          />
        </div>
      </div>
    </div>
  );
}
