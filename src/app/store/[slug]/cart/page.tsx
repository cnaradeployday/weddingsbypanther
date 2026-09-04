"use client";

import { use, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart, type CartItem } from "@/lib/cart";
import { formatUSD } from "@/lib/format";
import { savePersonalizationHandoff } from "@/lib/personalizationHandoff";
import { leadTimeRange } from "@/lib/leadTime";

function deliveryEstimate(item: CartItem): string | null {
  const range = leadTimeRange(item.leadTimeMin, item.leadTimeMax);
  return range ? `Ships in ${range}` : null;
}

function CartLineItem({
  item,
  onUpdateQuantity,
  onRemove,
  onEdit,
}: {
  item: CartItem;
  onUpdateQuantity: (key: string, quantity: number) => void;
  onRemove: (key: string) => void;
  onEdit: (item: CartItem) => void;
}) {
  const previewUrl = item.personalization?.snapshotUrl ?? item.personalization?.renderUrl ?? item.image;
  // A typable quantity field (not just +/- steps) mirrors the product
  // page's own quantity input — editing away from the current value only
  // commits (clamped to the item's minOrder) on blur/Enter, so a customer
  // can clear the field and type a new number without fighting a stepper.
  const [quantityInput, setQuantityInput] = useState(() => String(item.quantity));

  const commitQuantity = () => {
    const next = Math.max(item.minOrder, Number(quantityInput) || item.minOrder);
    onUpdateQuantity(item.key, next);
    setQuantityInput(String(next));
  };

  const step = (delta: number) => {
    const next = Math.max(item.minOrder, item.quantity + delta);
    onUpdateQuantity(item.key, next);
    setQuantityInput(String(next));
  };

  const delivery = deliveryEstimate(item);

  return (
    <div className="py-6 flex gap-4">
      <div className="relative h-24 w-24 rounded-lg overflow-hidden bg-cream shrink-0">
        {previewUrl && (
          <Image
            src={previewUrl}
            alt={item.name}
            fill
            className={item.personalization?.snapshotUrl || item.personalization?.renderUrl ? "object-contain" : "object-cover"}
            unoptimized={!!(item.personalization?.snapshotUrl ?? item.personalization?.renderUrl)}
          />
        )}
      </div>
      <div className="flex-1">
        <div className="flex justify-between">
          <p className="font-medium">
            {item.name}
            {item.isSample && (
              <span className="ml-2 text-[10px] uppercase tracking-wide text-terracotta align-middle">
                Sample
              </span>
            )}
          </p>
          <p className="font-medium">{formatUSD(item.unitPrice * item.quantity)}</p>
        </div>
        {item.personalization && (
          <p className="text-sm text-muted mt-1">
            &quot;{item.personalization.names}&quot; · {item.personalization.date} ·{" "}
            {item.personalization.technique}
          </p>
        )}
        {item.personalization?.inkColorHex && (
          <p className="text-xs text-muted mt-1 flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-3 rounded-full border border-line shrink-0"
              style={{ backgroundColor: item.personalization.inkColorHex }}
            />
            Ink: {item.personalization.inkColorHex.toUpperCase()}
            {item.personalization.inkPantoneCode && ` · ${item.personalization.inkPantoneCode} (approx.)`}
          </p>
        )}
        {delivery && <p className="text-xs text-muted mt-1">{delivery}</p>}
        <div className="flex items-center gap-4 mt-3">
          <div className="flex items-center gap-2 rounded-full border border-line px-3 py-1">
            <button onClick={() => step(-item.minOrder)} className="text-muted">
              −
            </button>
            <input
              type="number"
              value={quantityInput}
              onChange={(e) => setQuantityInput(e.target.value)}
              onBlur={commitQuantity}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitQuantity();
                }
              }}
              className="text-sm w-12 text-center bg-transparent focus:outline-none"
            />
            <button onClick={() => step(item.minOrder)} className="text-muted">
              +
            </button>
          </div>
          <button
            onClick={() => onEdit(item)}
            className="text-sm text-muted hover:text-terracotta"
          >
            Edit
          </button>
          <button
            onClick={() => onRemove(item.key)}
            className="text-sm text-muted hover:text-terracotta"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CartPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const { items, updateQuantity, removeItem, subtotal, personalizationFee, sampleFee, totalPieces } = useCart();
  const base = `/store/${slug}`;
  const total = subtotal + personalizationFee + sampleFee;

  // Sends the customer back to that product's configurator with its exact
  // personalization (text, logo flag, positions, sizes, rotations) carried
  // through the same handoff mechanism a related-product click uses — the
  // line itself is removed so finishing the edit and adding again doesn't
  // leave a stale duplicate behind. A raw logo file can't be recovered
  // (only a snapshot image and a "had a logo" flag are ever kept in the
  // cart), so an item with a logo will need it re-uploaded.
  const handleEdit = (item: CartItem) => {
    if (item.personalization) {
      savePersonalizationHandoff({
        names: item.personalization.names ?? "",
        date: item.personalization.date ?? "",
        monogram: item.personalization.monogram ?? "",
        logoDataUrl: null,
        frame: item.personalization.frame ?? "",
        textFont: item.personalization.textFont ?? "",
        elemScale: item.personalization.elemScale ?? {},
        positions: item.personalization.positions,
        elemRotationOffset: item.personalization.elemRotationOffset,
      });
    }
    removeItem(item.key);
    router.push(`${base}/shop/${item.slug}`);
  };

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
            <CartLineItem
              key={item.key}
              item={item}
              onUpdateQuantity={updateQuantity}
              onRemove={removeItem}
              onEdit={handleEdit}
            />
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
          {sampleFee > 0 && (
            <div className="flex justify-between">
              <span className="text-muted">Sample setup</span>
              <span>{formatUSD(sampleFee)}</span>
            </div>
          )}
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
