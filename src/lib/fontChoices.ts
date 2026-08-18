import type { CSSProperties } from "react";

// Curated serif/sans pairings a planner can pick for their storefront in
// Settings. Google fonts can't be loaded dynamically at runtime (next/font
// needs a static import per family), so the full set is preloaded once in
// the root layout as CSS variables; picking one just swaps which pair
// --font-serif/--font-sans point to for that storefront. Keep this list in
// sync with the font objects wired up in src/app/layout.tsx.
export const FONT_CHOICES = [
  { id: "cormorant", label: "Cormorant", description: "Classic wedding serif (default)" },
  { id: "playfair", label: "Playfair", description: "Bold, editorial serif" },
  { id: "baskerville", label: "Baskerville", description: "Traditional, literary serif" },
  { id: "marcellus", label: "Marcellus", description: "Refined all-caps-friendly serif" },
  { id: "fraunces", label: "Fraunces", description: "Warm, soft serif" },
] as const;

export type FontChoiceId = (typeof FONT_CHOICES)[number]["id"];

export const DEFAULT_FONT_CHOICE: FontChoiceId = "cormorant";

export function isFontChoiceId(value: string): value is FontChoiceId {
  return FONT_CHOICES.some((f) => f.id === value);
}

const FONT_PAIR_VARS: Record<FontChoiceId, { serif: string; sans: string }> = {
  cormorant: { serif: "var(--font-serif-cormorant)", sans: "var(--font-sans-instrument)" },
  playfair: { serif: "var(--font-serif-playfair)", sans: "var(--font-sans-worksans)" },
  baskerville: { serif: "var(--font-serif-baskerville)", sans: "var(--font-sans-karla)" },
  marcellus: { serif: "var(--font-serif-marcellus)", sans: "var(--font-sans-jost)" },
  fraunces: { serif: "var(--font-serif-fraunces)", sans: "var(--font-sans-manrope)" },
};

// CSS custom-property overrides for a storefront wrapper — inherits down to
// every element using --font-serif/--font-sans (which is all of them, via
// globals.css), the same pattern used for the planner's accent color.
export function fontChoiceVars(choice: string): CSSProperties {
  const id = isFontChoiceId(choice) ? choice : DEFAULT_FONT_CHOICE;
  const pair = FONT_PAIR_VARS[id];
  return {
    "--font-serif": pair.serif,
    "--font-sans": pair.sans,
  } as CSSProperties;
}
