// Approximate ink/material colors per print technique, shared between the
// AI-render compositor (server) and the manual live preview (client) so the
// two previews look consistent with each other.
export const TECHNIQUE_INK_COLOR: Record<string, string> = {
  "Foil stamp": "#c9a227",
  "Laser engrave": "#33261c",
  "Screen print": "#1a1a1a",
  Letterpress: "#1a1a1a",
  "UV print": "#232323",
  Embroidery: "#1f2b4d",
  "Wax seal": "#7a1f2b",
};

export const FALLBACK_INK_COLOR = "#232323";

export function techniqueInkColor(techniqueName?: string | null): string {
  if (!techniqueName) return FALLBACK_INK_COLOR;
  return TECHNIQUE_INK_COLOR[techniqueName] ?? FALLBACK_INK_COLOR;
}
