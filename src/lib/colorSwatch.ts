// Maps a free-text variant label (e.g. "DK Blue", "Hunter Green") to a
// real CSS color for the landing page's color-swatch circle — "en lugar
// de la palabra del color, un circulo con el color". Labels are typed by
// suppliers/admins with no fixed vocabulary, so this is a best-effort
// curated lookup (covering the promo-product color names actually seen in
// this catalog) rather than a full color-name parser; an unrecognized
// label falls back to a neutral gray swatch rather than guessing wrong.
const ABBREVIATIONS: Record<string, string> = {
  dk: "dark",
  lt: "light",
  med: "medium",
  gry: "gray",
  grn: "green",
  blk: "black",
  wht: "white",
  slvr: "silver",
};

const COLOR_NAMES: Record<string, string> = {
  black: "#1a1a1a",
  white: "#ffffff",
  "off white": "#f5f1e8",
  ivory: "#fffff0",
  cream: "#f6ead7",
  gray: "#808080",
  grey: "#808080",
  "dark gray": "#404040",
  "dark grey": "#404040",
  "light gray": "#d3d3d3",
  "light grey": "#d3d3d3",
  charcoal: "#36454f",
  silver: "#c0c0c0",
  red: "#d6262c",
  "dark red": "#8b0000",
  maroon: "#800000",
  burgundy: "#6d071a",
  wine: "#722f37",
  pink: "#f4a6c0",
  "hot pink": "#ff69b4",
  magenta: "#d6006d",
  orange: "#ff7800",
  "dark orange": "#cc5500",
  yellow: "#ffd700",
  gold: "#c9a227",
  khaki: "#c3b091",
  tan: "#d2b48c",
  beige: "#e8dcc8",
  brown: "#6b4226",
  "dark brown": "#4a2c1a",
  green: "#2e7d32",
  "dark green": "#1b4d1f",
  "light green": "#90ee90",
  "hunter green": "#355e3b",
  forest: "#228b22",
  "forest green": "#228b22",
  olive: "#6b6b1f",
  lime: "#9acd32",
  teal: "#008080",
  turquoise: "#30d5c8",
  aqua: "#00ffff",
  cyan: "#00bcd4",
  blue: "#1e6fd9",
  "dark blue": "#0d2d6b",
  "navy": "#0a1f44",
  "navy blue": "#0a1f44",
  "light blue": "#9ecdf0",
  "medium blue": "#3a7bd5",
  "sky blue": "#87ceeb",
  "royal blue": "#4169e1",
  "royal": "#4169e1",
  cobalt: "#0047ab",
  purple: "#6a3d9a",
  "dark purple": "#4b0082",
  "light purple": "#c9a0dc",
  lavender: "#b57edc",
  violet: "#7f00ff",
  plum: "#8e4585",
  coral: "#ff6f61",
  peach: "#ffcba4",
  rose: "#ff007f",
  clear: "#e8e8e8",
  transparent: "#e8e8e8",
  natural: "#e8dcc8",
  wood: "#8b5a2b",
  walnut: "#5c3a21",
  bamboo: "#d4c08c",
};

function normalize(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word) => ABBREVIATIONS[word] ?? word)
    .join(" ");
}

export const SWATCH_FALLBACK_COLOR = "#b8b8b8";

export function resolveSwatchColor(label: string): string {
  const normalized = normalize(label);
  if (COLOR_NAMES[normalized]) return COLOR_NAMES[normalized];
  // "DK Blue"/"Med Blue"/"LT Blue" style labels expand to "dark blue" etc.
  // above, but a plain, unlisted shade word on its own (e.g. just "Navy")
  // is covered by the table directly. Try the last word alone too (e.g.
  // "Steel Blue" -> "blue") as a looser fallback before giving up.
  const lastWord = normalized.split(" ").pop();
  if (lastWord && COLOR_NAMES[lastWord]) return COLOR_NAMES[lastWord];
  return SWATCH_FALLBACK_COLOR;
}
