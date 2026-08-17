"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import type { CatalogProduct } from "@/lib/queries";

const STYLES = ["Romantic", "Minimalist", "Rustic", "Modern", "Classic"];

type LineItem = { product: CatalogProduct; quantity: number };
type Tier = {
  label: string;
  tier: "under" | "fit" | "premium";
  items: LineItem[];
  total: number;
};

function guestTables(guests: number) {
  return Math.max(1, Math.ceil(guests / 10));
}

type CategorySlot = { qty: number; options: CatalogProduct[]; index: number };

function slotLineTotal(slot: CategorySlot): number {
  const p = slot.options[slot.index];
  if (!p) return 0;
  return p.price * Math.max(slot.qty, p.minOrder);
}

function slotsTotal(slots: CategorySlot[]): number {
  return slots.reduce((sum, s) => sum + slotLineTotal(s), 0);
}

// Every option is built from the same category plan (driven by guest count),
// starting from each category's cheapest matching product — this is what
// keeps every tier's products actually connected to what the customer
// entered, rather than a price picked out of thin air.
function buildBaseSlots(catalog: CatalogProduct[], guests: number): CategorySlot[] {
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

  return plan
    .map(({ slug, qty }) => {
      const options = (byCategory.get(slug) ?? []).slice().sort((a, b) => a.price - b.price);
      return { qty, options, index: 0 };
    })
    .filter((s) => s.options.length > 0);
}

// Greedily swaps each category's product for the next-more-expensive option
// — always picking whichever available upgrade costs the least — until the
// total reaches the target (or every category has run out of upgrades).
// This is what lets the base option actually spend the customer's stated
// budget instead of landing wherever the cheapest picks happen to total.
function upgradeToTarget(slots: CategorySlot[], target: number): CategorySlot[] {
  const working = slots.map((s) => ({ ...s }));
  let total = slotsTotal(working);
  while (total < target) {
    let bestGain = Infinity;
    let bestIndex = -1;
    working.forEach((slot, i) => {
      if (slot.index + 1 >= slot.options.length) return;
      const gain = slotLineTotal({ ...slot, index: slot.index + 1 }) - slotLineTotal(slot);
      if (gain > 0 && gain < bestGain) {
        bestGain = gain;
        bestIndex = i;
      }
    });
    if (bestIndex === -1) break;
    working[bestIndex].index += 1;
    total = slotsTotal(working);
  }
  return working;
}

function slotsToItems(slots: CategorySlot[]): LineItem[] {
  return slots
    .map((s) => {
      const product = s.options[s.index];
      if (!product) return null;
      return { product, quantity: Math.max(s.qty, product.minOrder) };
    })
    .filter((i): i is LineItem => i !== null);
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

    const baseSlots = buildBaseSlots(catalog, guests);
    // Tier 1 spends at least the customer's stated budget (upgrading from
    // the cheapest picks until it does). Tiers 2 and 3 upgrade further from
    // there to land at +20% and +40% over tier 1 specifically — not
    // compounding on each other — using real, connected product swaps the
    // whole way, so every number on screen is backed by actual line items.
    const tier1Slots = upgradeToTarget(baseSlots, budget);
    const items1 = slotsToItems(tier1Slots);
    const total1 = slotsTotal(tier1Slots);

    const tier2Slots = upgradeToTarget(tier1Slots, total1 * 1.2);
    const items2 = slotsToItems(tier2Slots);
    const total2 = slotsTotal(tier2Slots);

    const tier3Slots = upgradeToTarget(tier2Slots, total1 * 1.4);
    const items3 = slotsToItems(tier3Slots);
    const total3 = slotsTotal(tier3Slots);

    const tiers: Tier[] = [
      { label: "The Quiet Set", tier: "under", items: items1, total: total1 },
      { label: "The Signature Set", tier: "fit", items: items2, total: total2 },
      { label: "The Gilded Evening", tier: "premium", items: items3, total: total3 },
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
