import { notFound } from "next/navigation";
import { getPlannerBySlug } from "@/lib/queries";

// "en lugar de our work, pone about us, y ahi pone un state holder (en
// todos) con info de contacto" — "Our work" used to just link back to the
// storefront home page under a different label; this is a real page of its
// own. Every storefront gets one, and each planner's about blurb/contact
// details are editable from their own Storefront settings (and from the
// admin side of the same form) — see PlannerSettingsForm.tsx. Falls back to
// plain placeholder copy until a planner fills those in, so no storefront
// ever shows a half-empty page.
export default async function AboutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const planner = await getPlannerBySlug(slug);
  if (!planner) notFound();

  const contactRows = [
    { label: "Email", value: planner.contact_email },
    { label: "Phone", value: planner.contact_phone },
    { label: "Address", value: planner.contact_address },
  ].filter((row) => row.value?.trim());

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-xs uppercase tracking-[0.2em] text-terracotta mb-4">About us</p>
      <h1 className="font-serif text-4xl mb-6">{planner.business_name}</h1>
      <p className="text-muted whitespace-pre-line mb-12">
        {planner.about_text?.trim() ||
          `${planner.business_name} hand-picks and personalizes every piece in this collection. We'd love to tell you more about our studio here — check back soon.`}
      </p>

      <div className="rounded-2xl border border-line p-8">
        <h2 className="font-serif text-2xl mb-4">Get in touch</h2>
        {contactRows.length > 0 ? (
          <dl className="space-y-3 text-sm">
            {contactRows.map((row) => (
              <div key={row.label} className="flex gap-3">
                <dt className="w-20 shrink-0 text-muted">{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-muted">
            Contact details for {planner.business_name} will be posted here soon.
          </p>
        )}
      </div>
    </div>
  );
}
