import Link from "next/link";

export default async function CheckoutSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ order?: string }>;
}) {
  const { slug } = await params;
  const { order } = await searchParams;

  return (
    <div className="mx-auto max-w-xl px-6 py-28 text-center">
      <div className="h-16 w-16 rounded-full bg-sage text-cream-light flex items-center justify-center mx-auto mb-6 text-2xl">
        ✓
      </div>
      <h1 className="font-serif text-4xl mb-4">Order placed</h1>
      <p className="text-muted mb-2">
        Thank you — your order is being reviewed by our studio. We&apos;ll email proofs
        within 48 hours before anything goes to print.
      </p>
      {order && (
        <p className="text-xs text-muted mb-8">Order reference: {order.slice(0, 8).toUpperCase()}</p>
      )}
      <div className="flex flex-wrap items-center justify-center gap-4">
        <Link
          href={`/store/${slug}/shop`}
          className="inline-block px-6 py-3 rounded-full bg-terracotta text-cream-light text-sm font-medium hover:bg-terracotta-dark transition-colors"
        >
          Continue shopping
        </Link>
        <Link
          href={`/store/${slug}/orders`}
          className="inline-block px-6 py-3 rounded-full border border-line text-sm font-medium hover:border-dark transition-colors"
        >
          Track your order
        </Link>
        {order && (
          <a
            href={`/api/orders/${order}/receipt`}
            className="inline-block px-6 py-3 rounded-full border border-line text-sm font-medium hover:border-dark transition-colors"
          >
            Download receipt (PDF)
          </a>
        )}
      </div>
    </div>
  );
}
