import Link from "next/link";

export function StoreFooter({
  businessName,
  contactEmail,
  contactPhone,
  contactAddress,
}: {
  businessName: string;
  // "poder editar desde el backoffice... dato de contacto" — surfaced in
  // the footer (every page), not just the About us page, so it's always
  // one scroll away. Falls back to nothing shown when a planner hasn't
  // set any of these, same as the About page's own contact section.
  contactEmail?: string | null;
  contactPhone?: string | null;
  contactAddress?: string | null;
}) {
  const contactParts = [contactEmail, contactPhone, contactAddress].filter((v) => v?.trim());

  return (
    <footer className="border-t border-line bg-cream mt-24" style={{ color: "var(--header-footer-text)" }}>
      <div className="mx-auto max-w-7xl px-6 py-12 flex flex-col md:flex-row md:items-center md:justify-between gap-6 text-sm">
        <div>
          <span className="font-serif text-base">{businessName}</span>
          <span className="ml-2">— powered by Bespoke</span>
          {contactParts.length > 0 && (
            <div className="text-xs mt-1 opacity-80">{contactParts.join(" · ")}</div>
          )}
        </div>
        <div className="flex gap-6">
          <Link href="/" className="hover:text-terracotta transition-colors">
            Bespoke Marketplace
          </Link>
          <span>© 2026</span>
        </div>
      </div>
    </footer>
  );
}
