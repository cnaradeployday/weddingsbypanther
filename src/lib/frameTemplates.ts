// Decorative wedding frames/flourishes a customer can wrap around their
// names text, picked next to the logo upload. Same reasoning as
// monograms.ts: plain vector primitives, no font glyphs or raster assets,
// so the exact same markup renders identically in the browser preview and
// in the server-side compositor (sharp/librsvg has no dingbat font
// available there). Each entry's viewBox is a fixed 0 0 200 90 — wide, to
// match a line of text — and gets stretched with preserveAspectRatio="none"
// to whatever box the actual names text renders at, so the design uses
// mostly edge-hugging strokes rather than centered motifs that would
// distort under a large aspect change. None of these enclose the text in
// an actual rectangle/box — every design hugs the outer edge and stays
// open around the text itself.

export type FrameId = "laurel" | "arch" | "flourish" | "wreath" | "hearts" | "botanical";

export const FRAME_TEMPLATES: { id: FrameId; label: string }[] = [
  { id: "laurel", label: "Laurel" },
  { id: "arch", label: "Arch" },
  { id: "flourish", label: "Flourish" },
  { id: "wreath", label: "Wreath" },
  { id: "hearts", label: "Hearts" },
  { id: "botanical", label: "Botanical" },
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

function flower(cx: number, cy: number, r: number, stroke: string, petals = 5): string {
  const dots = Array.from({ length: petals }, (_, i) => {
    const rad = ((360 / petals) * i * Math.PI) / 180;
    const px = cx + Math.cos(rad) * r;
    const py = cy + Math.sin(rad) * r;
    return `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${(r * 0.78).toFixed(1)}" fill="${stroke}" opacity="0.85" />`;
  }).join("");
  return `${dots}<circle cx="${cx}" cy="${cy}" r="${(r * 0.42).toFixed(1)}" fill="white" />`;
}

function heart(cx: number, cy: number, size: number, fill: string, rotation = 0, opacity = 1): string {
  const s = size / 24;
  return `<g transform="translate(${cx} ${cy}) rotate(${rotation}) scale(${s.toFixed(3)}) translate(-12 -12)" opacity="${opacity}"><path d="M12,21.35l-1.45-1.32C5.4,15.36,2,12.28,2,8.5C2,5.42,4.42,3,7.5,3c1.74,0,3.41,0.81,4.5,2.09C13.09,3.81,14.76,3,16.5,3C19.58,3,22,5.42,22,8.5c0,3.78-3.4,6.86-8.55,11.54L12,21.35z" fill="${fill}" /></g>`;
}

// A vine climbing the outer edge with flowers along it, used for "wreath".
// Same edge-hugging curve as laurelSide (proven clear of the text at its
// widest) with alternating leaf/flower accents along it.
function vine(edgeX: number, direction: 1 | -1, stroke: string): string {
  const stemInnerX = edgeX - direction * 20;
  const accents = [0, 1, 2, 3, 4]
    .map((i) => {
      const t = 0.1 + i * 0.2;
      const x = edgeX - direction * 20 * (1 - t);
      const y = 8 + t * 72;
      if (i % 2 === 0) return flower(x, y, 3.4, stroke, 5);
      const angle = direction * 55 + (t - 0.5) * 30;
      return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="5.5" ry="2.6" fill="${stroke}" opacity="0.9" transform="rotate(${angle.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})" />`;
    })
    .join("");
  return `<path d="M ${edgeX} 8 Q ${stemInnerX} 45 ${edgeX} 82" fill="none" stroke="${stroke}" stroke-width="1.4" />${accents}`;
}

// A winding ivy vine with small leaves alternating both sides of its own
// curve (rather than laurel's leaves all fanning one way off a single
// bow), for a denser, leafier look distinct from "laurel".
function ivy(edgeX: number, direction: 1 | -1, stroke: string): string {
  // Worst-case reach from the edge is capped at 22 units (base 12 + wobble
  // 6 + leaf offset 4) — the same margin laurelSide uses, already proven
  // clear of text at its widest.
  const points = [0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => {
    const wobble = Math.sin(t * Math.PI * 2.5) * 6;
    return { x: edgeX - direction * (12 + wobble), y: 6 + t * 78 };
  });
  const path = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} ` + points.slice(1).map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const leaves = points
    .slice(1, -1)
    .map((p, i) => {
      const side = i % 2 === 0 ? 1 : -1;
      const lx = p.x + direction * side * 4;
      const angle = direction * side * 45;
      return `<ellipse cx="${lx.toFixed(1)}" cy="${p.y.toFixed(1)}" rx="4.5" ry="2.2" fill="${stroke}" opacity="0.9" transform="rotate(${angle} ${lx.toFixed(1)} ${p.y.toFixed(1)})" />`;
    })
    .join("");
  return `<path d="${path}" fill="none" stroke="${stroke}" stroke-width="1.3" stroke-linejoin="round" />${leaves}`;
}

// Returns SVG markup fragments (no outer <svg>) for a 0 0 200 90 viewBox.
export function frameSvgInner(id: string, stroke: string): string {
  switch (id as FrameId) {
    case "laurel":
      return `${laurelSide(6, -1, stroke)}${laurelSide(194, 1, stroke)}`;
    case "arch":
      return `<path d="M 4 20 Q 100 2 196 20" fill="none" stroke="${stroke}" stroke-width="1.6" />`;
    case "flourish":
      return `<path d="M 25 45 C 10 45 10 24 24 24 C 33 24 33 35 21 35" fill="none" stroke="${stroke}" stroke-width="1.6" stroke-linecap="round" />
              <path d="M 175 45 C 190 45 190 24 176 24 C 167 24 167 35 179 35" fill="none" stroke="${stroke}" stroke-width="1.6" stroke-linecap="round" />`;
    case "wreath":
      // A fuller floral garland along both edges plus a small flower
      // accent centered in the top margin, well clear of the text below.
      return `${flower(100, 10, 4.2, stroke, 6)}${vine(8, -1, stroke)}${vine(192, 1, stroke)}`;
    case "hearts":
      return `${heart(100, 11, 11, stroke, 0)}
              ${heart(20, 30, 8, stroke, -18, 0.9)}${heart(12, 55, 6, stroke, -10, 0.7)}
              ${heart(180, 30, 8, stroke, 18, 0.9)}${heart(188, 55, 6, stroke, 10, 0.7)}`;
    case "botanical":
      return `${ivy(9, -1, stroke)}${ivy(191, 1, stroke)}`;
    default:
      return "";
  }
}
