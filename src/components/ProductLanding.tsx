"use client";

import { useState } from "react";
import Image from "next/image";
import { formatUSD, applyMarkup } from "@/lib/format";
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

  if (started) {
    return <ProductConfigurator product={product} relatedProducts={relatedProducts} initialVariantId={variantId} />;
  }

  const selectedVariant = sortedVariants.find((v) => v.id === variantId);
  const heroImage = selectedVariant?.image_url ?? product.images[0]?.url ?? null;
  const price = applyMarkup(product.factoryPrice + (selectedVariant?.price_delta ?? 0), product.markupPct);

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
            {formatUSD(price)} <span className="text-sm text-muted font-normal">per piece · min {product.minOrder}</span>
          </p>
          {product.description && <p className="text-muted">{product.description}</p>}
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
          onClick={() => setStarted(true)}
          disabled={!variantId}
          className="h-12 rounded-full bg-terracotta text-cream-light text-sm font-medium hover:bg-terracotta-dark transition-colors disabled:opacity-50"
        >
          Personalize
        </button>
      </div>
    </div>
  );
}
