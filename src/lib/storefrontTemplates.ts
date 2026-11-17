// "necesito en las cajas blancas poder tener mas de un template del
// front... que se vean en el back office con una preview y que se
// puedan elegir" — the catalog of selectable storefront home-page
// layouts (see src/components/storefront-templates/), shared between
// the picker in PlannerSettingsForm and the dispatch in
// src/app/store/[slug]/page.tsx so both stay in sync with one list.
export type StorefrontTemplateId =
  | "classic"
  | "modern"
  | "bold"
  | "editorial"
  | "minimal"
  | "gallery"
  | "boutique"
  | "playful"
  | "grid"
  | "showcase";

export const STOREFRONT_TEMPLATES: {
  id: StorefrontTemplateId;
  label: string;
  description: string;
}[] = [
  {
    id: "classic",
    label: "Classic",
    description: "Side-by-side hero, image category tiles, a clean featured grid.",
  },
  {
    id: "modern",
    label: "Modern",
    description: "Full-bleed photo hero, scrolling category pills, a 3-up product grid.",
  },
  {
    id: "bold",
    label: "Bold",
    description: "Dark type-first hero, solid-color category chips, large 2-up product cards.",
  },
  {
    id: "editorial",
    label: "Editorial",
    description: "Magazine-style masthead, a numbered category index, an asymmetric lookbook grid.",
  },
  {
    id: "minimal",
    label: "Minimal",
    description: "No hero photo — plain type, underlined text categories, a spare caption-only grid.",
  },
  {
    id: "gallery",
    label: "Gallery",
    description: "Near full-screen photo, a sidebar category list, a masonry product wall.",
  },
  {
    id: "boutique",
    label: "Boutique",
    description: "Soft luxury hero with gold rules, ringed category icons, shadowed product cards.",
  },
  {
    id: "playful",
    label: "Playful",
    description: "Rounded floating hero bubble, colorful category pills, gently tilted product cards.",
  },
  {
    id: "grid",
    label: "Grid",
    description: "Strict Swiss-grid hero and category row, a dense ruled product grid.",
  },
  {
    id: "showcase",
    label: "Showcase",
    description: "Cinematic hero with a docked info bar, oversized category cards, a scrolling carousel.",
  },
];

export function isStorefrontTemplateId(value: string): value is StorefrontTemplateId {
  return STOREFRONT_TEMPLATES.some((t) => t.id === value);
}
