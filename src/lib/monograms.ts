// Monogram accents rendered as plain vector shapes (not font glyphs).
// Font-based dingbat/symbol characters were rendering as blank "tofu"
// boxes in the server-side compositor (sharp/librsvg on Vercel doesn't
// reliably resolve rare Unicode blocks to an installed font), so every
// monogram here is built from basic SVG primitives — guaranteed to look
// identical in the browser and in the server render, with no font
// dependency at all. Each entry's `svg` is inner markup for a 0 0 24 24
// viewBox; `fill` is substituted at render time for the ink color.

export type MonogramId = "heart" | "rings" | "star" | "flower" | "diamond";

export const MONOGRAM_OPTIONS: { id: MonogramId; label: string }[] = [
  { id: "heart", label: "Heart" },
  { id: "rings", label: "Rings" },
  { id: "star", label: "Star" },
  { id: "flower", label: "Flower" },
  { id: "diamond", label: "Diamond" },
];

function starPolygonPoints(cx: number, cy: number, outerR: number, innerR: number, points: number): string {
  const coords: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (Math.PI / points) * i - Math.PI / 2;
    coords.push(`${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`);
  }
  return coords.join(" ");
}

function flowerCircles(fill: string): string {
  const petals = [0, 72, 144, 216, 288]
    .map((deg) => {
      const rad = (deg * Math.PI) / 180;
      const cx = 12 + Math.cos(rad) * 5;
      const cy = 12 + Math.sin(rad) * 5;
      return `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="4.2" fill="${fill}" />`;
    })
    .join("");
  return `${petals}<circle cx="12" cy="12" r="2.6" fill="white" />`;
}

// Returns SVG markup fragments (no outer <svg>) for a 0 0 24 24 viewBox.
export function monogramSvgInner(id: string, fill: string): string {
  switch (id as MonogramId) {
    case "heart":
      return `<path d="M12,21.35l-1.45-1.32C5.4,15.36,2,12.28,2,8.5C2,5.42,4.42,3,7.5,3c1.74,0,3.41,0.81,4.5,2.09C13.09,3.81,14.76,3,16.5,3C19.58,3,22,5.42,22,8.5c0,3.78-3.4,6.86-8.55,11.54L12,21.35z" fill="${fill}" />`;
    case "rings":
      return `<circle cx="8.8" cy="12" r="4.2" fill="none" stroke="${fill}" stroke-width="2.4" /><circle cx="15.2" cy="12" r="4.2" fill="none" stroke="${fill}" stroke-width="2.4" />`;
    case "star":
      return `<polygon points="${starPolygonPoints(12, 12, 10, 4.2, 5)}" fill="${fill}" />`;
    case "flower":
      return flowerCircles(fill);
    case "diamond":
      return `<rect x="6" y="6" width="12" height="12" fill="${fill}" transform="rotate(45 12 12)" />`;
    default:
      return "";
  }
}
