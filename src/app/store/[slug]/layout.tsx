import { notFound } from "next/navigation";
import { CartProvider } from "@/lib/cart";
import { StoreHeader } from "@/components/StoreHeader";
import { StoreFooter } from "@/components/StoreFooter";
import { getPlannerBySlug } from "@/lib/queries";
import { darken } from "@/lib/color";
import { fontChoiceVars } from "@/lib/fontChoices";
import { DEFAULT_STOREFRONT_SUBTITLE, isBusinessType } from "@/lib/businessType";

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

  if (planner.status !== "approved") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream px-6 text-center">
        <div className="max-w-sm">
          <p className="font-serif text-xl tracking-wide mb-6">BESPOKE</p>
          <h1 className="font-serif text-3xl mb-3">{planner.business_name}</h1>
          <p className="text-muted">
            This storefront is being reviewed by our team and isn&apos;t live yet. Check back
            soon.
          </p>
        </div>
      </div>
    );
  }

  const accentVars = {
    "--color-terracotta": planner.accent_color,
    "--color-terracotta-dark": darken(planner.accent_color, 0.15),
    "--color-gold": planner.secondary_color,
    ...fontChoiceVars(planner.font_choice),
  } as React.CSSProperties;

  return (
    <CartProvider plannerSlug={slug}>
      <div className="flex min-h-screen flex-col" style={accentVars}>
        <StoreHeader
          plannerSlug={slug}
          businessName={planner.business_name}
          subtitle={
            planner.storefront_subtitle?.trim() ||
            DEFAULT_STOREFRONT_SUBTITLE[isBusinessType(planner.business_type) ? planner.business_type : "wedding"]
          }
          initials={planner.initials}
          logoUrl={planner.logo_url}
          showProposalBuilder={planner.business_type !== "merchandise"}
        />
        <main className="flex-1">{children}</main>
        <StoreFooter businessName={planner.business_name} />
      </div>
    </CartProvider>
  );
}
