"use client";

import Image from "next/image";
import Link from "next/link";
import { use } from "react";
import { useCart } from "@/lib/cart";
import { formatUSD } from "@/lib/format";

export default function CartPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { items, updateQuantity, removeItem, subtotal, personalizationFee, totalPieces } = useCart();
  const base = `/store/${slug}`;
  const total = subtotal + personalizationFee;

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="font-serif text-3xl mb-4">Your cart is empty</h1>
        <p className="text-muted mb-8">Browse the collection and add a few pieces to get started.</p>
        <Link href={`${base}/shop`} className="px-6 py-3 rounded-full bg-terracotta text-cream-light text-sm font-medium">
          Browse Products
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-10 grid md:grid-cols-[1fr_360px] gap-12 items-start">
      <div>
        <h1 className="font-serif text-4xl mb-1">Your Cart</h1>
        <p className="text-muted mb-8">{items.length} items · {totalPieces} pieces</p>

        <div className="divide-y divide-line">
          {items.map((item) => (
            <div key={item.key} className="py-6 flex gap-4">
              <div className="relative h-24 w-24 rounded-lg overflow-hidden bg-cream shrink-0">
                {item.image && <Image src={item.image} alt={item.name} fill className="object-cover" />}
              </div>
              <div className="flex-1">
                <div className="flex justify-between">
                  <p className="font-medium">{item.name}</p>
                  <p className="font-medium">{formatUSD(item.unitPrice * item.quantity)}</p>
                </div>
                {item.personalization && (
                  <p className="text-sm text-muted mt-1">
                    &quot;{item.personalization.names}&quot; · {item.personalization.date} ·{" "}
                    {item.personalization.technique}
                  </p>
                )}
                <div className="flex items-center gap-4 mt-3">
                  <div className="flex items-center gap-2 rounded-full border border-line px-3 py-1">
                    <button
                      onClick={() => updateQuantity(item.key, item.quantity - item.minOrder)}
                      className="text-muted"
                    >
                      −
                    </button>
                    <span className="text-sm w-8 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.key, item.quantity + item.minOrder)}
                      className="text-muted"
                    >
                      +
                    </button>
                  </div>
                  <button
                    onClick={() => removeItem(item.key)}
                    className="text-sm text-muted hover:text-terracotta"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-cream p-6 sticky top-24">
        <h2 className="font-serif text-2xl mb-5">Order summary</h2>
        <div className="space-y-2 text-sm mb-5">
          <div className="flex justify-between">
            <span className="text-muted">Subtotal</span>
            <span>{formatUSD(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Personalization</span>
            <span>{formatUSD(personalizationFee)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Shipping</span>
            <span className="text-muted">At checkout</span>
          </div>
        </div>
        <div className="flex justify-between items-baseline border-t border-line pt-4 mb-6">
          <span className="font-serif text-lg">Total</span>
          <span className="font-serif text-2xl">{formatUSD(total)}</span>
        </div>
        <Link
          href={`${base}/checkout`}
          className="block text-center px-6 py-3 rounded-full bg-terracotta text-cream-light text-sm font-medium hover:bg-terracotta-dark transition-colors mb-3"
        >
          Proceed to Checkout
        </Link>
        <Link href={`${base}/shop`} className="block text-center text-sm text-muted">
          Continue shopping
        </Link>
      </div>
    </div>
  );
}
