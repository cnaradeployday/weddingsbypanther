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
export type TextFontId =
  | "cormorant"
  | "playfair"
  | "greatvibes"
  | "montserrat"
  | "ebgaramond"
  | "parisienne"
  | "dancingscript"
  | "alexbrush"
  | "sacramento"
  | "allura"
  | "pacifico"
  | "merriweather"
  | "lora"
  | "crimsontext"
  | "ptserif"
  | "abrilfatface"
  | "bodonimoda"
  | "poppins"
  | "inter"
  | "raleway"
  | "nunito"
  | "opensans"
  | "lato"
  | "quicksand"
  | "josefinsans"
  | "oswald";

export type TextFontCategory = "script" | "serif" | "sans" | "display";

export const TEXT_FONTS: { id: TextFontId; label: string; cssVar: string; serverFamily: string; category: TextFontCategory }[] = [
  { id: "cormorant", label: "Cormorant", cssVar: "--font-serif-cormorant", serverFamily: "Cormorant Garamond", category: "serif" },
  { id: "playfair", label: "Playfair", cssVar: "--font-serif-playfair", serverFamily: "Playfair Display SemiBold", category: "serif" },
  { id: "greatvibes", label: "Great Vibes", cssVar: "--font-text-greatvibes", serverFamily: "Great Vibes", category: "script" },
  { id: "montserrat", label: "Montserrat", cssVar: "--font-text-montserrat", serverFamily: "Montserrat Medium", category: "sans" },
  { id: "ebgaramond", label: "EB Garamond", cssVar: "--font-text-ebgaramond", serverFamily: "EB Garamond Medium", category: "serif" },
  { id: "parisienne", label: "Parisienne", cssVar: "--font-text-parisienne", serverFamily: "Parisienne", category: "script" },
  // "See more" expansion — each loaded at a single weight (400), which
  // keeps its serverFamily identical to its plain Google Fonts name (see
  // layout.tsx's note on why a non-400 instance would break that).
  { id: "dancingscript", label: "Dancing Script", cssVar: "--font-text-dancingscript", serverFamily: "Dancing Script", category: "script" },
  { id: "alexbrush", label: "Alex Brush", cssVar: "--font-text-alexbrush", serverFamily: "Alex Brush", category: "script" },
  { id: "sacramento", label: "Sacramento", cssVar: "--font-text-sacramento", serverFamily: "Sacramento", category: "script" },
  { id: "allura", label: "Allura", cssVar: "--font-text-allura", serverFamily: "Allura", category: "script" },
  { id: "pacifico", label: "Pacifico", cssVar: "--font-text-pacifico", serverFamily: "Pacifico", category: "script" },
  { id: "merriweather", label: "Merriweather", cssVar: "--font-text-merriweather", serverFamily: "Merriweather", category: "serif" },
  { id: "lora", label: "Lora", cssVar: "--font-text-lora", serverFamily: "Lora", category: "serif" },
  { id: "crimsontext", label: "Crimson Text", cssVar: "--font-text-crimsontext", serverFamily: "Crimson Text", category: "serif" },
  { id: "ptserif", label: "PT Serif", cssVar: "--font-text-ptserif", serverFamily: "PT Serif", category: "serif" },
  { id: "abrilfatface", label: "Abril Fatface", cssVar: "--font-text-abrilfatface", serverFamily: "Abril Fatface", category: "display" },
  { id: "bodonimoda", label: "Bodoni Moda", cssVar: "--font-text-bodonimoda", serverFamily: "Bodoni Moda", category: "display" },
  { id: "poppins", label: "Poppins", cssVar: "--font-text-poppins", serverFamily: "Poppins", category: "sans" },
  { id: "inter", label: "Inter", cssVar: "--font-text-inter", serverFamily: "Inter", category: "sans" },
  { id: "raleway", label: "Raleway", cssVar: "--font-text-raleway", serverFamily: "Raleway", category: "sans" },
  { id: "nunito", label: "Nunito", cssVar: "--font-text-nunito", serverFamily: "Nunito", category: "sans" },
  { id: "opensans", label: "Open Sans", cssVar: "--font-text-opensans", serverFamily: "Open Sans", category: "sans" },
  { id: "lato", label: "Lato", cssVar: "--font-text-lato", serverFamily: "Lato", category: "sans" },
  { id: "quicksand", label: "Quicksand", cssVar: "--font-text-quicksand", serverFamily: "Quicksand", category: "sans" },
  { id: "josefinsans", label: "Josefin Sans", cssVar: "--font-text-josefinsans", serverFamily: "Josefin Sans", category: "sans" },
  { id: "oswald", label: "Oswald", cssVar: "--font-text-oswald", serverFamily: "Oswald", category: "display" },
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
