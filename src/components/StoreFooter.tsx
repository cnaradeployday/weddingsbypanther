import Link from "next/link";

export function StoreFooter({ businessName }: { businessName: string }) {
  return (
    <footer className="border-t border-line bg-cream mt-24">
      <div className="mx-auto max-w-7xl px-6 py-12 flex flex-col md:flex-row md:items-center md:justify-between gap-6 text-sm text-muted">
        <div>
          <span className="font-serif text-base text-dark">{businessName}</span>
          <span className="ml-2">— powered by Bespoke</span>
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
