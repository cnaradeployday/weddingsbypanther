import { notFound } from "next/navigation";
import { getProposal } from "@/lib/queries";
import { ProposalResults } from "@/components/ProposalResults";

export default async function ProposalPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const result = await getProposal(id);
  if (!result) notFound();

  return (
    <ProposalResults
      plannerSlug={slug}
      guestCount={result.proposal.guest_count}
      budget={result.proposal.budget}
      styles={result.proposal.style_preferences}
      options={result.options}
    />
  );
}
