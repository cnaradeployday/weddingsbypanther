"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";
import { formatUSD } from "@/lib/format";

const TIER_LABEL: Record<string, string> = {
  under: "Under Budget",
  fit: "Best Fit",
  premium: "Most Premium",
};

type ProposalOption = {
  id: string;
  label: string;
  tier: string;
  totalPrice: number;
  items: { productId: string; slug: string; name: string; image: string | null; quantity: number; unitPrice: number }[];
};

export function ProposalResults({
  plannerSlug,
  guestCount,
  budget,
  styles,
  options,
}: {
  plannerSlug: string;
  guestCount: number;
  budget: number;
  styles: string[];
  options: ProposalOption[];
}) {
  const router = useRouter();
  const { addItem } = useCart();

  const handleAddAll = (option: ProposalOption) => {
    for (const item of option.items) {
      addItem({
        key: `${item.productId}:proposal:${option.id}`,
        productId: item.productId,
        slug: item.slug,
        name: item.name,
        image: item.image,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        minOrder: item.quantity,
      });
    }
    router.push(`/store/${plannerSlug}/cart`);
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
        <div>
          <p className="text-xs uppercase tracking-wide text-terracotta mb-2">Step 2 of 2</p>
          <h1 className="font-serif text-4xl">
            Three ways to <em className="italic">dress the day.</em>
          </h1>
        </div>
        <p className="text-sm text-muted">
          {guestCount} guests · {formatUSD(budget)} budget
          {styles.length ? ` · ${styles.join(", ")}` : ""}
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {options.map((option) => (
          <div key={option.id} className="rounded-2xl border border-line overflow-hidden bg-cream-light flex flex-col">
            <div className="grid grid-cols-2 gap-0.5 bg-line">
              {option.items.slice(0, 4).map((item, i) => (
                <div key={item.productId + i} className="relative aspect-square bg-cream">
                  {item.image && <Image src={item.image} alt={item.name} fill className="object-cover" />}
                </div>
              ))}
            </div>
            <div className="p-6 flex-1 flex flex-col">
              <span className="inline-block self-start text-[10px] uppercase tracking-wide bg-cream px-2 py-1 rounded-full mb-3">
                {TIER_LABEL[option.tier] ?? option.tier}
              </span>
              <div className="flex justify-between items-baseline mb-4">
                <h2 className="font-serif text-2xl">{option.label}</h2>
                <span className="text-right">
                  <span className="block font-serif text-xl">{formatUSD(option.totalPrice)}</span>
                  <span className="block text-xs text-muted">
                    {formatUSD(option.totalPrice / Math.max(1, guestCount))} / guest
                  </span>
                </span>
              </div>
              <ul className="text-sm space-y-1.5 mb-6 flex-1">
                {option.items.map((item, i) => (
                  <li key={item.productId + i} className="flex justify-between text-dark/80">
                    <span>{item.quantity} × {item.name}</span>
                    <span className="text-muted">{formatUSD(item.unitPrice * item.quantity)}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleAddAll(option)}
                className="w-full px-6 py-3 rounded-full bg-terracotta text-cream-light text-sm font-medium hover:bg-terracotta-dark transition-colors"
              >
                Add All to Cart
              </button>
            </div>
          </div>
        ))}
      </div>

      <p className="text-center text-sm text-muted mt-10">
        Not quite right?{" "}
        <a href={`/store/${plannerSlug}/builder`} className="text-terracotta font-medium">
          Regenerate with new preferences
        </a>
      </p>
    </div>
  );
}
