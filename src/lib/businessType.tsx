// The same codebase serves two verticals from two separate Vercel
// deployments (and domains) — the original wedding-storefront business and
// a new promotional-merchandise one — sharing this one Supabase backend.
// A planner/storefront's own vertical always comes from its own DB row
// (`planners.business_type`), since both deployments query the same data
// and a storefront should render identically no matter which domain it's
// viewed from. This env var only answers a narrower question: which
// vertical does *this deployment* represent by default, for the shared
// marketing pages that have no specific planner in context yet (the root
// home page, "become a planner/distributor" signup). Set NEXT_PUBLIC_
// BUSINESS_TYPE=merchandise on the merchandise Vercel project; the
// original project needs no env var at all (wedding is the default).
export type BusinessType = "wedding" | "merchandise";

export const DEPLOYMENT_BUSINESS_TYPE: BusinessType =
  process.env.NEXT_PUBLIC_BUSINESS_TYPE === "merchandise" ? "merchandise" : "wedding";

export function isBusinessType(value: string): value is BusinessType {
  return value === "wedding" || value === "merchandise";
}

type BusinessCopy = {
  siteName: string;
  tagline: string;
  heroKicker: string;
  heroTitle: React.ReactNode;
  heroSubtitle: string;
  // A real product photo when we have one on hand; null tells the page to
  // render a plain brand-color panel instead (see HeroPanel) rather than
  // reach for wedding stock photography that would contradict the whole
  // point of a distinct promotional-products look.
  heroImage: string | null;
  heroImageAlt: string;
  accountNoun: string; // "planner" vs "distributor" — used in prose, lowercase
  accountNounCap: string; // "Planner" vs "Distributor" — used in headings/buttons
  becomeAccountHeading: string;
  becomeAccountKicker: string;
  becomeAccountBody: string;
  storefrontPitchKicker: string;
  storefrontPitchTitle: React.ReactNode;
  storefrontPitchBody: string;
  storefrontPitchImage: string | null;
  storefrontPitchImageAlt: string;
  footerBlurb: string;
  howItWorksStep1: string;
  howItWorksStep2: string;
};

export const BUSINESS_COPY: Record<BusinessType, BusinessCopy> = {
  wedding: {
    siteName: "BESPOKE",
    tagline: "Wedding merchandise, made personal",
    heroKicker: "Marketplace for wedding details",
    heroTitle: (
      <>
        Wedding merchandise,
        <br />
        <em className="italic">made personal.</em>
      </>
    ),
    heroSubtitle:
      "Design custom favors and centerpieces for your own day — or build a wedding business selling them to your clients.",
    heroImage: "/images/hero-gingham-table.jpg",
    heroImageAlt: "Wedding table setting",
    accountNoun: "planner",
    accountNounCap: "Planner",
    becomeAccountHeading: "Become a Planner",
    becomeAccountKicker: "For Wedding Planners",
    becomeAccountBody:
      "Open a branded shop on your own subdomain, pick which products to carry, and set your own markup. Tell us a bit about your business and our team will follow up.",
    storefrontPitchKicker: "For Wedding Planners",
    storefrontPitchTitle: (
      <>
        Your own storefront,
        <br />
        your own margin.
      </>
    ),
    storefrontPitchBody:
      "Open a branded shop on your own subdomain, pick which products to carry, and set your markup per item. We handle production and delivery.",
    storefrontPitchImage: "/images/planners-ceremony-arch.jpg",
    storefrontPitchImageAlt: "Wedding ceremony arch",
    footerBlurb: "Wedding merchandise, made personal — for couples and the planners who serve them.",
    howItWorksStep1:
      "Browse favors, centerpieces and stationery from approved suppliers, filtered by budget and print technique.",
    howItWorksStep2: "Add your names, date and monogram — or upload your own artwork — and see it rendered live.",
  },
  merchandise: {
    siteName: "MERCHANDISE",
    tagline: "Branded promotional products, done right",
    heroKicker: "Marketplace for promotional products",
    heroTitle: (
      <>
        Branded merchandise,
        <br />
        <em className="italic">made to order.</em>
      </>
    ),
    heroSubtitle:
      "Personalize drinkware, apparel and corporate gifts with your logo — or build a distribution business selling them to your own clients.",
    heroImage: null,
    heroImageAlt: "Branded promotional products",
    accountNoun: "distributor",
    accountNounCap: "Distributor",
    becomeAccountHeading: "Become a Distributor",
    becomeAccountKicker: "For Promotional Product Distributors",
    becomeAccountBody:
      "Open a branded storefront on your own subdomain, pick which products to carry, and set your own markup. Tell us a bit about your business and our team will follow up.",
    storefrontPitchKicker: "For Distributors",
    storefrontPitchTitle: (
      <>
        Your own storefront,
        <br />
        your own margin.
      </>
    ),
    storefrontPitchBody:
      "Open a branded shop on your own subdomain, pick which products to carry, and set your markup per item. We handle production and fulfillment.",
    storefrontPitchImage: null,
    storefrontPitchImageAlt: "Branded promotional products on display",
    footerBlurb: "Branded promotional products, done right — for businesses and the distributors who serve them.",
    howItWorksStep1:
      "Browse drinkware, apparel and corporate gifts from approved suppliers, filtered by budget and print technique.",
    howItWorksStep2: "Add your logo and brand colors — or upload your own artwork — and see it rendered live.",
  },
};
