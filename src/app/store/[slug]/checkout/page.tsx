import { notFound } from "next/navigation";
import { getPlannerBySlug } from "@/lib/queries";
import { CheckoutForm } from "@/components/CheckoutForm";

export default async function CheckoutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const planner = await getPlannerBySlug(slug);
  if (!planner) notFound();

  return <CheckoutForm plannerId={planner.id} plannerSlug={slug} />;
}
