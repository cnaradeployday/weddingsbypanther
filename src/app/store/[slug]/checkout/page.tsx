import { notFound } from "next/navigation";
import { getPlannerBySlug } from "@/lib/queries";
import { CheckoutForm } from "@/components/CheckoutForm";
import { isBusinessType } from "@/lib/businessType";

export default async function CheckoutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const planner = await getPlannerBySlug(slug);
  if (!planner) notFound();

  return (
    <CheckoutForm
      plannerId={planner.id}
      plannerSlug={slug}
      businessType={isBusinessType(planner.business_type) ? planner.business_type : "wedding"}
    />
  );
}
