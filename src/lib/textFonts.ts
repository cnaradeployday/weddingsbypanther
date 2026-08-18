import type { CSSProperties } from "react";

// Fonts a customer can pick for their names/date personalization text —
// distinct from the planner's storefront font (fontChoices.ts), chosen per
// order rather than per store. Reuses the Cormorant/Playfair Google Font
// loads already preloaded in the root layout for the storefront picker
// (same families, no need to load them twice); the other four are loaded
// there specifically for this picker. Each also has a subset .ttf bundled
// in public/fonts and registered with fontconfig (see
// personalizationComposite.ts) so the AI render and cart snapshot use the
// exact same font as this live preview instead of falling back to
// whatever's installed on the server (nothing, on Vercel).
export type TextFontId = "cormorant" | "playfair" | "greatvibes" | "montserrat" | "ebgaramond" | "parisienne";

export const TEXT_FONTS: { id: TextFontId; label: string; cssVar: string; serverFamily: string }[] = [
  { id: "cormorant", label: "Cormorant", cssVar: "--font-serif-cormorant", serverFamily: "Cormorant Garamond" },
  { id: "playfair", label: "Playfair", cssVar: "--font-serif-playfair", serverFamily: "Playfair Display SemiBold" },
  { id: "greatvibes", label: "Great Vibes", cssVar: "--font-text-greatvibes", serverFamily: "Great Vibes" },
  { id: "montserrat", label: "Montserrat", cssVar: "--font-text-montserrat", serverFamily: "Montserrat Medium" },
  { id: "ebgaramond", label: "EB Garamond", cssVar: "--font-text-ebgaramond", serverFamily: "EB Garamond Medium" },
  { id: "parisienne", label: "Parisienne", cssVar: "--font-text-parisienne", serverFamily: "Parisienne" },
];

export const DEFAULT_TEXT_FONT: TextFontId = "cormorant";

export function isTextFontId(value: string): value is TextFontId {
  return TEXT_FONTS.some((f) => f.id === value);
}

export function textFontStyle(id: string): CSSProperties {
  const font = TEXT_FONTS.find((f) => f.id === id) ?? TEXT_FONTS[0];
  return { fontFamily: `var(${font.cssVar}), serif` };
}

// The font-family name the server's compositor should use for this choice
// — resolved via fontconfig from the bundled file, not the Google Fonts
// canonical name (fontTools' name-table rewrite when instancing a
// variable font's weight can shift it, e.g. "Playfair Display SemiBold").
export function textFontServerFamily(id: string): string {
  const font = TEXT_FONTS.find((f) => f.id === id) ?? TEXT_FONTS[0];
  return font.serverFamily;
}
