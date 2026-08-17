import { notFound } from "next/navigation";
import { CartProvider } from "@/lib/cart";
import { StoreHeader } from "@/components/StoreHeader";
import { StoreFooter } from "@/components/StoreFooter";
import { getPlannerBySlug } from "@/lib/queries";
import { darken } from "@/lib/color";

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

  const accentVars = {
    "--color-terracotta": planner.accent_color,
    "--color-terracotta-dark": darken(planner.accent_color, 0.15),
  } as React.CSSProperties;

  return (
    <CartProvider plannerSlug={slug}>
      <div className="flex min-h-screen flex-col" style={accentVars}>
        <StoreHeader
          plannerSlug={slug}
          businessName={planner.business_name}
          initials={planner.initials}
          logoUrl={planner.logo_url}
        />
        <main className="flex-1">{children}</main>
        <StoreFooter businessName={planner.business_name} />
      </div>
    </CartProvider>
  );
}
