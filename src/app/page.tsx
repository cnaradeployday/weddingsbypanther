import Image from "next/image";
import Link from "next/link";
import { getCategories } from "@/lib/queries";
import { DEPLOYMENT_BUSINESS_TYPE, BUSINESS_COPY } from "@/lib/businessType";
import { BrandPanel } from "@/components/BrandPanel";

const CATEGORY_IMAGES: Record<string, string> = {
  "wedding-favors": "/images/favors-ringbox-flatlay.jpg",
  centerpieces: "/images/centerpieces-gold-chandelier.jpg",
  "table-numbers": "/images/tablenumbers-long-table.jpg",
  "place-cards": "/images/placecards-waxseal-charger.jpg",
  "guest-books": "/images/guestbooks-waxseal-press.jpg",
  "welcome-bags": "/images/welcomebags-floral-card.jpg",
};

const DEMO_STORE = "aster-vine";

export default async function Home() {
  const copy = BUSINESS_COPY[DEPLOYMENT_BUSINESS_TYPE];
  // The catalog/demo-store sections below (categories, guest-count proposal
  // builder) only have wedding data behind them today — showing them for
  // the merchandise deployment would mean either wedding categories under
  // a merchandise brand, or a broken link to a demo store that doesn't
  // exist yet. Both stay wedding-only until a real merchandise catalog and
  // demo storefront exist.
  const isWedding = DEPLOYMENT_BUSINESS_TYPE === "wedding";
  const categories = isWedding ? await getCategories() : [];

  return (
    <div>
      <header className="border-b border-line">
        <div className="mx-auto max-w-7xl px-6 py-5 flex items-center justify-between">
          <span className="font-serif text-xl tracking-wide">{copy.siteName}</span>
          <nav className="hidden md:flex items-center gap-8 text-sm text-dark/80">
            <Link href="/store" className="hover:text-terracotta transition-colors">
              Shop
            </Link>
            <Link href="#accounts" className="hover:text-terracotta transition-colors">
              For {copy.accountNounCap}s
            </Link>
          </nav>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/planner" className="hidden sm:inline hover:text-terracotta transition-colors">
              Sign in
            </Link>
            <Link
              href="/store"
              className="px-5 py-2.5 rounded-full bg-dark text-cream-light hover:bg-dark-soft transition-colors"
            >
              Start Designing
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-16 grid md:grid-cols-2 gap-10 items-center">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-terracotta mb-4">{copy.heroKicker}</p>
          <h1 className="font-serif text-5xl md:text-6xl leading-[1.05] mb-6">{copy.heroTitle}</h1>
          <p className="text-muted max-w-md mb-8">{copy.heroSubtitle}</p>
          <div className="flex flex-wrap gap-3 mb-10">
            <Link
              href="/store"
              className="px-6 py-3 rounded-full bg-terracotta text-cream-light text-sm font-medium hover:bg-terracotta-dark transition-colors"
            >
              Start Designing
            </Link>
            <Link
              href="/become-a-planner"
              className="px-6 py-3 rounded-full border border-dark/20 text-sm font-medium hover:border-dark transition-colors"
            >
              Become a {copy.accountNounCap}
            </Link>
          </div>
          <div className="flex gap-8 text-sm text-muted">
            <span><strong className="text-dark">240+</strong> products</span>
            <span><strong className="text-dark">14 days</strong> average delivery</span>
          </div>
        </div>
        <div className="relative h-[440px] rounded-2xl overflow-hidden">
          {copy.heroImage ? (
            <Image src={copy.heroImage} alt={copy.heroImageAlt} fill className="object-cover" priority />
          ) : (
            <BrandPanel />
          )}
        </div>
      </section>

      <section className="bg-cream py-16">
        <div className="mx-auto max-w-7xl px-6">
          <p className="text-xs uppercase tracking-[0.2em] text-terracotta mb-3">How it works</p>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
            <h2 className="font-serif text-4xl max-w-lg">
              Three steps to something only yours.
            </h2>
            <p className="text-sm text-muted max-w-xs">
              Everything is proofed by a human before it goes to print.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 border-t border-line pt-8">
            {[
              ["01", "Choose your products", copy.howItWorksStep1],
              ["02", "Personalize with your details", copy.howItWorksStep2],
              ["03", "We create it for you", "Printed, packed and delivered on time, with proofs approved by you first."],
            ].map(([num, title, body]) => (
              <div key={num}>
                <p className="text-terracotta font-serif text-lg mb-3">{num}</p>
                <h3 className="font-medium mb-2">{title}</h3>
                <p className="text-sm text-muted">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {isWedding && (
        <section className="mx-auto max-w-7xl px-6 py-20">
          <div className="flex items-end justify-between mb-8">
            <h2 className="font-serif text-4xl">Shop by category</h2>
            <Link href={`/store/${DEMO_STORE}/shop`} className="text-sm text-terracotta">
              View all products →
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/store/${DEMO_STORE}/shop?category=${cat.slug}`}
                className="relative h-48 rounded-xl overflow-hidden group"
              >
                <Image
                  src={CATEGORY_IMAGES[cat.slug] ?? "/images/hero-tablescape.jpg"}
                  alt={cat.name}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                <span className="absolute bottom-3 left-4 text-cream-light font-serif text-lg">
                  {cat.name}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {isWedding && (
        <section className="mx-auto max-w-7xl px-6 pb-20">
          <div className="rounded-2xl bg-dark text-cream-light p-10 md:p-14 grid md:grid-cols-2 gap-8 items-center">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-gold mb-3">Proposal Builder</p>
              <h2 className="font-serif text-4xl mb-4">
                Tell us your budget and guest count
              </h2>
              <p className="text-cream-light/70 mb-6 max-w-md">
                We&apos;ll suggest the perfect combination of favors, table pieces and
                stationery — priced to the last guest, ready to customize.
              </p>
              <Link
                href={`/store/${DEMO_STORE}/builder`}
                className="inline-block px-6 py-3 rounded-full bg-cream-light text-dark text-sm font-medium hover:bg-white transition-colors"
              >
                Build my proposal
              </Link>
            </div>
            <div className="bg-white/5 rounded-xl p-6 space-y-4">
              <div className="flex justify-between text-sm bg-white/5 rounded-lg px-4 py-3">
                <span className="text-cream-light/70">Total budget</span>
                <span>$3,500</span>
              </div>
              <div className="flex justify-between text-sm bg-white/5 rounded-lg px-4 py-3">
                <span className="text-cream-light/70">Guests</span>
                <span>120</span>
              </div>
            </div>
          </div>
        </section>
      )}

      <section id="accounts" className="mx-auto max-w-7xl px-6 pb-24 grid md:grid-cols-2 gap-10 items-center">
        <div className="relative h-[380px] rounded-2xl overflow-hidden order-2 md:order-1">
          {copy.storefrontPitchImage ? (
            <Image
              src={copy.storefrontPitchImage}
              alt={copy.storefrontPitchImageAlt}
              fill
              className="object-cover"
            />
          ) : (
            <BrandPanel />
          )}
        </div>
        <div className="order-1 md:order-2">
          <p className="text-xs uppercase tracking-[0.2em] text-terracotta mb-3">{copy.storefrontPitchKicker}</p>
          <h2 className="font-serif text-4xl mb-4">{copy.storefrontPitchTitle}</h2>
          <p className="text-muted mb-6 max-w-md">{copy.storefrontPitchBody}</p>
          <div className="flex gap-3">
            <Link
              href="/become-a-planner"
              className="px-6 py-3 rounded-full bg-dark text-cream-light text-sm font-medium hover:bg-dark-soft transition-colors"
            >
              Become a {copy.accountNounCap}
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-line bg-cream">
        <div className="mx-auto max-w-7xl px-6 py-14 grid sm:grid-cols-2 md:grid-cols-4 gap-10">
          <div>
            <span className="font-serif text-xl tracking-wide">{copy.siteName}</span>
            <p className="text-sm text-muted mt-3 max-w-xs">{copy.footerBlurb}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted mb-3">Shop</p>
            <ul className="space-y-2 text-sm">
              {isWedding ? (
                <>
                  <li><Link href={`/store/${DEMO_STORE}/shop`}>Favors</Link></li>
                  <li><Link href={`/store/${DEMO_STORE}/shop`}>Centerpieces</Link></li>
                  <li><Link href={`/store/${DEMO_STORE}/shop`}>Table numbers</Link></li>
                </>
              ) : (
                <li><Link href="/store">Browse all products</Link></li>
              )}
            </ul>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted mb-3">Business</p>
            <ul className="space-y-2 text-sm">
              <li><Link href="/become-a-planner">For {copy.accountNoun}s</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted mb-3">Company</p>
            <ul className="space-y-2 text-sm">
              <li><Link href="/admin">Admin</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-line py-6 text-center text-xs text-muted">
          © 2026 {copy.siteName}
        </div>
      </footer>
    </div>
  );
}
