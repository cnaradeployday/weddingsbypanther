import { notFound } from "next/navigation";
import { getPlannerBySlug, getStorefrontCatalog } from "@/lib/queries";
import { BuilderForm } from "@/components/BuilderForm";

export default async function BuilderPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const planner = await getPlannerBySlug(slug);
  if (!planner) notFound();
  // The proposal builder ("budget in, ideas out") is a wedding-specific
  // concept — a promotional-merchandise storefront has no equivalent, so
  // the route doesn't exist for it even if linked directly.
  if (planner.business_type === "merchandise") notFound();

  const catalog = await getStorefrontCatalog(slug);

  return <BuilderForm plannerId={planner.id} plannerSlug={slug} catalog={catalog} />;
}
