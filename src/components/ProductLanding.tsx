"use client";

import { useState } from "react";
import Image from "next/image";
import { formatUSD, applyMarkup } from "@/lib/format";
import { parseQuantityInput, isQuantityBelowMinimum } from "@/lib/quantityValidation";
import { ProductConfigurator, type ProductConfiguratorProduct } from "./ProductConfigurator";
import type { RelatedProduct } from "@/lib/queries";

// "al momento de elegir el producto, antes del product builder, necesitamos
// poder elegir el color" — the variant/color picker used to live inside
// Confirmation, the very last step, so the customer only saw it after
// already designing against whichever variant happened to be selected by
// default. Gates entry into the builder (ProductConfigurator, which starts
// on Design) behind a plain product landing screen when the product
// actually has more than one variant to choose from — a single-variant (or
// variant-less) product skips straight to the builder exactly as before,
// since there's nothing to choose.
export function ProductLanding({
  product,
  relatedProducts = [],
}: {
  relatedProducts?: RelatedProduct[];
  product: ProductConfiguratorProduct;
}) {
  const sortedVariants = [...product.variants].sort((a, b) => a.sort_order - b.sort_order);
  const [variantId, setVariantId] = useState(sortedVariants[0]?.id ?? "");
  const [started, setStarted] = useState(sortedVariants.length <= 1);

  // "poder ver los precios, con breking qty aca, poder ir modificando y
  // viendo los precios" — "los qty breaks sacalos de donde los saques para
  // esta pantalla" pointed at Confirmation's own quick-quantity buttons
  // (ConfirmationStep.tsx), which this mirrors exactly: there's no actual
  // tiered/discount pricing anywhere in this app — the per-unit price is
  // flat — so each button is just that same flat price multiplied out at a
  // handful of common quantities, plus a free-typed quantity field for any
  // other amount. The quantity picked here carries into the builder as its
  // initial quantity (ProductConfigurator's own initialQuantity prop)
  // instead of being silently discarded like initialVariantId used to be.
  const popularQty = product.popularQty && product.popularQty >= product.minOrder ? product.popularQty : null;
  const baseQuickQuantities = [product.minOrder, product.minOrder * 2, product.minOrder * 4, product.minOrder * 8];
  const quickQuantities = Array.from(new Set(baseQuickQuantities)).slice(0, 4);

  const [quantity, setQuantity] = useState(popularQty ?? product.minOrder);
  const [quantityInput, setQuantityInput] = useState(String(quantity));
  const quantityBelowMinimum = isQuantityBelowMinimum(quantityInput, product.minOrder);

  const updateQuantity = (next: number) => {
    setQuantity(next);
    setQuantityInput(String(next));
  };
  const commitQuantityInput = () => {
    const parsed = parseQuantityInput(quantityInput);
    if (parsed !== null && parsed >= product.minOrder) updateQuantity(parsed);
    else setQuantityInput(String(quantity));
  };

  if (started) {
    return (
      <ProductConfigurator
        product={product}
        relatedProducts={relatedProducts}
        initialVariantId={variantId}
        initialQuantity={quantity}
      />
    );
  }

  const selectedVariant = sortedVariants.find((v) => v.id === variantId);
  const heroImage = selectedVariant?.image_url ?? product.images[0]?.url ?? null;
  const unitPrice = applyMarkup(product.factoryPrice + (selectedVariant?.price_delta ?? 0), product.markupPct);

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 md:py-12 grid md:grid-cols-2 gap-8 md:gap-12">
      <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-cream">
        {heroImage && <Image src={heroImage} alt={product.name} fill className="object-cover" unoptimized />}
      </div>
      <div className="flex flex-col gap-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted mb-1">{product.categoryName}</p>
          <h1 className="font-serif text-3xl mb-2">{product.name}</h1>
          <p className="text-xl mb-3">
            {formatUSD(unitPrice)} <span className="text-sm text-muted font-normal">per piece · min {product.minOrder}</span>
          </p>
          {product.description && <p className="text-muted">{product.description}</p>}
        </div>

        <div>
          <label className="text-xs uppercase tracking-wide text-muted block mb-2">Quantity</label>
          <div className="flex gap-2 flex-wrap mb-3">
            {quickQuantities.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => updateQuantity(q)}
                className={`px-4 py-2 rounded-lg text-sm border text-left ${quantity === q ? "border-dark bg-cream" : "border-line"}`}
              >
                <span className="block font-medium">
                  {q}
                  {q === popularQty && (
                    <span className="ml-1.5 text-[10px] uppercase tracking-wide text-terracotta align-middle">Popular</span>
                  )}
                </span>
                <span className="text-xs text-muted">
                  {formatUSD(unitPrice)}/ea · {formatUSD(unitPrice * q)}
                </span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={product.minOrder}
              value={quantityInput}
              onChange={(e) => setQuantityInput(e.target.value)}
              onBlur={commitQuantityInput}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitQuantityInput();
                }
              }}
              aria-label="Quantity"
              className="w-24 rounded-lg border border-line px-3 py-2 text-sm focus:outline-none focus:border-dark"
            />
            <span className="text-sm text-muted">
              units · total {formatUSD(unitPrice * (parseQuantityInput(quantityInput) ?? quantity))}
            </span>
          </div>
          {quantityBelowMinimum && (
            <p className="text-xs text-terracotta-dark mt-1">Minimum order is {product.minOrder} units.</p>
          )}
        </div>

        <div>
          <label className="text-xs uppercase tracking-wide text-muted block mb-2">
            {sortedVariants[0]?.sku ? "Option" : "Color"}
          </label>
          <div className="flex flex-wrap gap-2">
            {sortedVariants.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setVariantId(v.id)}
                className={`px-4 py-2 rounded-lg text-sm border text-left ${variantId === v.id ? "border-dark bg-cream" : "border-line"}`}
              >
                <span className="block font-medium">{v.label}</span>
                {v.price_delta !== 0 && (
                  <span className="text-xs text-muted">
                    {v.price_delta > 0 ? "+" : ""}
                    {formatUSD(applyMarkup(v.price_delta, product.markupPct))}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            // A typed quantity that was never blurred/committed (still
            // sitting in quantityInput) would otherwise be silently
            // dropped in favor of the last committed `quantity` state.
            commitQuantityInput();
            setStarted(true);
          }}
          disabled={!variantId || quantityBelowMinimum}
          className="h-12 rounded-full bg-terracotta text-cream-light text-sm font-medium hover:bg-terracotta-dark transition-colors disabled:opacity-50"
        >
          Personalize
        </button>
      </div>
    </div>
  );
}
