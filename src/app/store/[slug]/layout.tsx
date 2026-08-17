import { notFound } from "next/navigation";
import { CartProvider } from "@/lib/cart";
import { StoreHeader } from "@/components/StoreHeader";
import { StoreFooter } from "@/components/StoreFooter";
import { getPlannerBySlug } from "@/lib/queries";

export default async function StorefrontLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const planner = await getPlannerBySlug(slug);
  if (!planner) notFound();

  return (
    <CartProvider plannerSlug={slug}>
      <div className="flex min-h-screen flex-col">
        <StoreHeader
          plannerSlug={slug}
          businessName={planner.business_name}
          initials={planner.initials}
        />
        <main className="flex-1">{children}</main>
        <StoreFooter businessName={planner.business_name} />
      </div>
    </CartProvider>
  );
}
