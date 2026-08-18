import Image from "next/image";
import Link from "next/link";
import { getPlanners } from "@/lib/queries";

export default async function StorePickerPage() {
  const planners = await getPlanners();

  return (
    <div className="min-h-screen">
      <header className="border-b border-line">
        <div className="mx-auto max-w-7xl px-6 py-5 flex items-center justify-between">
          <Link href="/" className="font-serif text-xl tracking-wide">
            BESPOKE
          </Link>
          <Link href="/planner" className="text-sm hover:text-terracotta transition-colors">
            Sign in
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-16">
        <p className="text-xs uppercase tracking-[0.2em] text-terracotta mb-3">Choose a store</p>
        <h1 className="font-serif text-4xl mb-3">Whose wedding are you shopping for?</h1>
        <p className="text-muted max-w-lg mb-10">
          Every store on Bespoke is run by an independent wedding planner, with their own
          catalog and pricing. Pick one to start designing.
        </p>

        {planners.length === 0 ? (
          <p className="text-muted text-sm">No stores are open yet — check back soon.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {planners.map((p) => (
              <Link
                key={p.id}
                href={`/store/${p.slug}/shop`}
                className="flex items-center gap-4 rounded-2xl border border-line p-5 hover:border-dark transition-colors"
              >
                <div
                  className="relative h-14 w-14 shrink-0 rounded-full overflow-hidden flex items-center justify-center text-cream-light font-serif text-lg"
                  style={{ backgroundColor: p.accent_color }}
                >
                  {p.logo_url ? (
                    <Image src={p.logo_url} alt="" fill className="object-cover" />
                  ) : (
                    <span>{p.initials ?? p.business_name.slice(0, 2).toUpperCase()}</span>
                  )}
                </div>
                <div>
                  <p className="font-medium">{p.business_name}</p>
                  {p.tagline && <p className="text-sm text-muted">{p.tagline}</p>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
