// "necesito en las cajas blancas poder tener mas de un template del
// front... que se vean en el back office con una preview y que se
// puedan elegir" — the catalog of selectable storefront home-page
// layouts (see src/components/storefront-templates/), shared between
// the picker in PlannerSettingsForm and the dispatch in
// src/app/store/[slug]/page.tsx so both stay in sync with one list.
export type StorefrontTemplateId = "classic" | "modern" | "bold";

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
];

export function isStorefrontTemplateId(value: string): value is StorefrontTemplateId {
  return STOREFRONT_TEMPLATES.some((t) => t.id === value);
}
