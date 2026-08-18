// Decorative wedding frames/flourishes a customer can wrap around their
// names text, picked next to the logo upload. Same reasoning as
// monograms.ts: plain vector primitives, no font glyphs or raster assets,
// so the exact same markup renders identically in the browser preview and
// in the server-side compositor (sharp/librsvg has no dingbat font
// available there). Each entry's viewBox is a fixed 0 0 200 90 — wide, to
// match a line of text — and gets stretched with preserveAspectRatio="none"
// to whatever box the actual names text renders at, so the design uses
// mostly edge-hugging strokes rather than centered motifs that would
// distort under a large aspect change.

export type FrameId = "laurel" | "border" | "arch" | "flourish" | "floral" | "dotted";

export const FRAME_TEMPLATES: { id: FrameId; label: string }[] = [
  { id: "laurel", label: "Laurel" },
  { id: "border", label: "Border" },
  { id: "arch", label: "Arch" },
  { id: "flourish", label: "Flourish" },
  { id: "floral", label: "Floral" },
  { id: "dotted", label: "Dotted" },
];

function laurelSide(edgeX: number, direction: 1 | -1, stroke: string): string {
  // A short vertical stem hugging the outer edge (within the outer 20% of
  // the viewBox) with leaves fanning further outward — kept entirely clear
  // of the horizontal center so it never collides with the text there,
  // whatever width the text ends up stretching this frame to.
  const stemInnerX = edgeX - direction * 22;
  const leaves = [0, 1, 2, 3]
    .map((i) => {
      const t = 0.15 + i * 0.24;
      const x = edgeX - direction * 22 * (1 - t);
      const y = 12 + t * 66;
      const angle = direction * 55 + (t - 0.5) * 30;
      return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="6.5" ry="3" fill="${stroke}" transform="rotate(${angle.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})" />`;
    })
    .join("");
  return `<path d="M ${edgeX} 8 Q ${stemInnerX} 45 ${edgeX} 82" fill="none" stroke="${stroke}" stroke-width="1.6" />${leaves}`;
}

function floralSprig(cx: number, cy: number, stroke: string): string {
  const petals = [0, 72, 144, 216, 288]
    .map((deg) => {
      const rad = (deg * Math.PI) / 180;
      const px = cx + Math.cos(rad) * 4.5;
      const py = cy + Math.sin(rad) * 4.5;
      return `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="3.4" fill="${stroke}" opacity="0.85" />`;
    })
    .join("");
  return `${petals}<circle cx="${cx}" cy="${cy}" r="2" fill="white" />`;
}

// Returns SVG markup fragments (no outer <svg>) for a 0 0 200 90 viewBox.
export function frameSvgInner(id: string, stroke: string): string {
  switch (id as FrameId) {
    case "laurel":
      return `${laurelSide(6, -1, stroke)}${laurelSide(194, 1, stroke)}`;
    case "border":
      return `<rect x="6" y="8" width="188" height="74" fill="none" stroke="${stroke}" stroke-width="1.4" />
              <rect x="11" y="13" width="178" height="64" fill="none" stroke="${stroke}" stroke-width="0.8" />`;
    case "arch":
      return `<path d="M 4 20 Q 100 2 196 20" fill="none" stroke="${stroke}" stroke-width="1.6" />`;
    case "flourish":
      return `<path d="M 25 45 C 10 45 10 24 24 24 C 33 24 33 35 21 35" fill="none" stroke="${stroke}" stroke-width="1.6" stroke-linecap="round" />
              <path d="M 175 45 C 190 45 190 24 176 24 C 167 24 167 35 179 35" fill="none" stroke="${stroke}" stroke-width="1.6" stroke-linecap="round" />`;
    case "floral":
      return `<rect x="8" y="10" width="184" height="70" fill="none" stroke="${stroke}" stroke-width="1" />
              ${floralSprig(18, 20, stroke)}${floralSprig(182, 20, stroke)}${floralSprig(18, 70, stroke)}${floralSprig(182, 70, stroke)}`;
    case "dotted":
      return `<rect x="8" y="10" width="184" height="70" fill="none" stroke="${stroke}" stroke-width="1.2" stroke-dasharray="3,4" />
              <rect x="4" y="6" width="8" height="8" fill="${stroke}" transform="rotate(45 8 10)" />
              <rect x="188" y="6" width="8" height="8" fill="${stroke}" transform="rotate(45 192 10)" />
              <rect x="4" y="76" width="8" height="8" fill="${stroke}" transform="rotate(45 8 80)" />
              <rect x="188" y="76" width="8" height="8" fill="${stroke}" transform="rotate(45 192 80)" />`;
    default:
      return "";
  }
}
