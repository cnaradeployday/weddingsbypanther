import { monogramSvgInner } from "./monograms";
import { frameSvgInner } from "./frameTemplates";
import { textLineCount } from "./textFit";
import { textLinesToPathData, measureLineWidth } from "./textOutline";
import { boundingBox, quadUV, type Point } from "./quadGeometry";
import type { ElemKey } from "./personalizationComposite";

// Shrinks `desiredSize` down to fit `text`'s longest line within
// `availableWidth`, measured with the outline's own real font metrics
// (measureLineWidth) rather than textFit.ts's cheap average-character-width
// estimate. That estimate is tuned for the raster preview, which has no
// hard edge to clip against; the print-ready outline's page is sized
// exactly to the print area in real mm, so an underestimated width let text
// run past the page boundary and get clipped there instead of just looking
// a little off. Advance widths (and a proportional letterSpacing) scale
// linearly with font size, so measuring once at `desiredSize` gives an
// exact scale-down ratio — no iteration needed.
async function fitFontSizeToWidth(
  text: string,
  fontId: string,
  desiredSize: number,
  availableWidth: number,
  letterSpacingRatio = 0
): Promise<number> {
  if (!text.trim() || availableWidth <= 0) return desiredSize;
  const width = await measureLineWidth(fontId, text, desiredSize, desiredSize * letterSpacingRatio);
  if (width <= 0 || width <= availableWidth) return desiredSize;
  // A 1.5mm floor, not textFit.ts's 6 — that floor is a minimum legible
  // size in *raster pixels* for the live preview; reused here against real
  // millimeters it was nearly a centimeter tall, which stopped shrinking
  // well before the text actually fit and let it overflow the page anyway.
  // A genuinely tiny result here means the customer scaled/positioned that
  // element into a spot it can't fit — an unreadably-small but correctly
  // bounded outline is still far more usable to a print shop than one that
  // bleeds off the physical page.
  return Math.max(1.5, desiredSize * (availableWidth / width));
}

export type OutlineLayoutItem =
  | { kind: "monogram"; markup: string; cx: number; cy: number; rotationDeg: number; scale: number }
  | { kind: "frame"; markup: string; cx: number; cy: number; rotationDeg: number; scaleX: number; scaleY: number }
  | { kind: "text"; ds: string[]; color: string; cx: number; cy: number; rotationDeg: number }
  | {
      kind: "logo";
      ds: string[];
      color: string;
      cx: number;
      cy: number;
      rotationDeg: number;
      scale: number;
      sourceWidth: number;
      sourceHeight: number;
    };

// A logo traced into vector path data at upload time (see
// src/lib/logoVectorize.ts) — only available for single-color-ink
// techniques, where the print-ready outline needs the logo as true curves
// rather than an embedded raster. `ds` are the traced path(s)' `d`
// attributes in the traced bitmap's own pixel space (width x height).
export type LogoVector = { ds: string[]; width: number; height: number };

export type OutlineLayoutParams = {
  canvasW: number;
  canvasH: number;
  // The print zone's true corners_pct quad (TL/TR/BR/BL, percent-of-photo)
  // — undefined/invalid falls back to the old flat percent-of-canvas math.
  zoneCorners?: Point[];
  positions: Record<string, { x: number; y: number }>;
  names: string;
  date: string;
  monogram: string;
  frame?: string;
  textFont?: string;
  inkColor: string;
  logoVector?: LogoVector | null;
  fontScale?: Partial<Record<ElemKey, number>>;
  rotations?: Partial<Record<ElemKey, number>>;
};

// The layout math shared by every print-ready export format (currently
// SVG and PDF) — what to draw and exactly where, independent of how it
// gets serialized. Kept separate from string/JSX building so the two
// formats can never drift apart on the actual positioning logic (the part
// that's easy to get subtly wrong, as the quad-unwarping fix here proves).
export async function computeOutlineLayout({
  canvasW,
  canvasH,
  zoneCorners,
  positions,
  names,
  date,
  monogram,
  frame = "",
  textFont = "",
  inkColor,
  logoVector,
  fontScale = {},
  rotations = {},
}: OutlineLayoutParams): Promise<OutlineLayoutItem[]> {
  const pos = (key: string, fallback: { x: number; y: number }) => positions[key] ?? fallback;
  // `positions` are stored as percentages *within the print zone's own
  // axis-aligned bounding box* (zoneBox) — the same coordinate space the
  // on-photo overlay and its drag/resize handles use, and the space
  // buildArtworkImage's photo composite approximates in (a plain rectangle
  // the size of that bounding box, rotated as one piece to match the
  // zone's tilt). That approximation reads fine layered back onto the same
  // skewed photo it was measured against, but a print-ready export has no
  // photo behind it — it's the flat, physically-true print surface — so a
  // position needs to be un-warped through the zone's real quad shape
  // (not just its bounding box) to land in the same relative spot the
  // customer actually saw on the mockup, rather than stretched/skewed by
  // however much the bounding box's aspect ratio differs from the quad's.
  const validQuad = zoneCorners && zoneCorners.length === 4 ? zoneCorners : null;
  const zoneBox = validQuad ? boundingBox(validQuad) : null;
  const toCanvasPoint = (key: string, fallback: { x: number; y: number }): { x: number; y: number } => {
    const p = pos(key, fallback);
    if (!validQuad || !zoneBox || !zoneBox.width || !zoneBox.height) {
      return { x: (p.x / 100) * canvasW, y: (p.y / 100) * canvasH };
    }
    const fullPct: Point = {
      x: zoneBox.left + (p.x / 100) * zoneBox.width,
      y: zoneBox.top + (p.y / 100) * zoneBox.height,
    };
    const { u, v } = quadUV(fullPct, validQuad);
    return { x: u * canvasW, y: v * canvasH };
  };

  const items: OutlineLayoutItem[] = [];

  if (logoVector && logoVector.ds.length) {
    const { x: cx, y: cy } = toCanvasPoint("logo", { x: 50, y: 35 });
    // Mirrors defaultLogoBoxSize() in personalizationComposite.ts: 45% of
    // the print area's smaller physical dimension, as a square bounding
    // box the traced logo is fit into (its larger dimension touching the
    // box's edge, matching the live builder's object-contain sizing).
    const boxMm = Math.min(canvasW, canvasH) * 0.45 * (fontScale.logo ?? 1);
    const scale = boxMm / Math.max(logoVector.width, logoVector.height, 1);
    items.push({
      kind: "logo",
      ds: logoVector.ds,
      color: inkColor,
      cx,
      cy,
      rotationDeg: rotations.logo ?? 0,
      scale,
      sourceWidth: logoVector.width,
      sourceHeight: logoVector.height,
    });
  }

  if (monogram.trim()) {
    const { x: cx, y: cy } = toCanvasPoint("monogram", { x: 50, y: 15 });
    const size = canvasH * 0.14 * (fontScale.monogram ?? 1);
    items.push({
      kind: "monogram",
      markup: monogramSvgInner(monogram, inkColor),
      cx,
      cy,
      rotationDeg: rotations.monogram ?? 0,
      scale: size / 24,
    });
  }

  if (names.trim()) {
    const { x: cx, y: cy } = toCanvasPoint("names", { x: 50, y: 65 });
    const trimmed = names.trim();
    const lines = trimmed.split("\n").map((l) => l.trim());
    const lineCount = textLineCount(trimmed);
    // Text is centered on cx, so the room actually available is bounded by
    // whichever side of cx is closer to the canvas edge — not a flat
    // fraction of the full canvas width. An element dragged/scaled off
    // -center (as the live builder's own resize handles now allow, right up
    // to the print area's true edge) has much less room on its near side
    // than that flat bound assumed, which was letting the text run past the
    // page boundary and get clipped there instead of shrinking to fit.
    const availableWidth = Math.max(1, 2 * Math.min(cx, canvasW - cx) * 0.98);
    const fontSize = await fitFontSizeToWidth(trimmed, textFont, canvasH * 0.11 * (fontScale.names ?? 1), availableWidth);
    const lineHeight = fontSize * 1.25;

    if (frame.trim()) {
      const textW = await measureLineWidth(textFont, trimmed, fontSize);
      const textH = lineHeight * lineCount;
      const padX = fontSize * 0.7;
      const padY = fontSize * 0.45;
      const boxW = textW + padX * 2;
      const boxH = textH + padY * 2;
      items.push({
        kind: "frame",
        markup: frameSvgInner(frame.trim(), inkColor),
        cx,
        cy,
        rotationDeg: rotations.names ?? 0,
        scaleX: boxW / 200,
        scaleY: boxH / 90,
      });
    }

    const firstLineCenterY = cy - ((lineCount - 1) / 2) * lineHeight;
    const centerYs = lines.map((_, i) => firstLineCenterY + i * lineHeight);
    const pathsData = await textLinesToPathData(lines, textFont, fontSize, cx, centerYs);
    const ds = pathsData.filter(Boolean);
    if (ds.length) {
      items.push({ kind: "text", ds, color: inkColor, cx, cy, rotationDeg: rotations.names ?? 0 });
    }
  }

  if (date.trim()) {
    const { x: cx, y: cy } = toCanvasPoint("date", { x: 50, y: 82 });
    const trimmed = date.trim();
    // See the "names" block above — bounded by the nearer edge from cx, not
    // a flat fraction of the full canvas width.
    const availableWidth = Math.max(1, 2 * Math.min(cx, canvasW - cx) * 0.98);
    const fontSize = await fitFontSizeToWidth(trimmed, textFont, canvasH * 0.05 * (fontScale.date ?? 1), availableWidth, 0.08);
    const [d] = await textLinesToPathData([trimmed], textFont, fontSize, cx, [cy], fontSize * 0.08);
    if (d) {
      items.push({ kind: "text", ds: [d], color: inkColor, cx, cy, rotationDeg: rotations.date ?? 0 });
    }
  }

  return items;
}

// Print-ready companion to buildArtworkImage (personalizationComposite.ts):
// same layout math (positions, font sizing, frame padding), but names/date
// come out as real vector path outlines instead of font-bound <text>, and
// there's no photo background or raster logo — just the artwork a print
// shop cuts/engraves/etches from. Sized in real millimeters (the product's
// print zone dimensions) so opening the file in any vector editor shows it
// at true physical size.
export async function buildOutlineArtworkSvg(params: OutlineLayoutParams): Promise<string> {
  const { canvasW, canvasH } = params;
  const layout = await computeOutlineLayout(params);

  const elements = layout.map((item) => {
    if (item.kind === "monogram") {
      return `<g transform="translate(${item.cx} ${item.cy}) rotate(${item.rotationDeg}) scale(${item.scale}) translate(-12 -12)">${item.markup}</g>`;
    }
    if (item.kind === "frame") {
      return `<g transform="translate(${item.cx} ${item.cy}) rotate(${item.rotationDeg}) scale(${item.scaleX} ${item.scaleY}) translate(-100 -45)">${item.markup}</g>`;
    }
    if (item.kind === "logo") {
      const paths = item.ds.map((d) => `<path d="${d}" fill="${item.color}" />`).join("");
      return `<g transform="translate(${item.cx} ${item.cy}) rotate(${item.rotationDeg}) scale(${item.scale}) translate(${-item.sourceWidth / 2} ${-item.sourceHeight / 2})">${paths}</g>`;
    }
    const paths = item.ds.map((d) => `<path d="${d}" fill="${item.color}" />`).join("");
    return `<g${item.rotationDeg ? ` transform="rotate(${item.rotationDeg} ${item.cx} ${item.cy})"` : ""}>${paths}</g>`;
  });

  // All the math above works in plain millimeters, matching the print
  // zone's own width_mm/height_mm — correct for physical sizing, but a
  // viewBox that small (tens of units) is a problem for less careful
  // print/laser tooling: some importers ignore the width/height="Xmm"
  // attributes entirely and treat raw viewBox numbers as pixels (the SVG
  // spec's own fallback), which would silently shrink a 60-unit design down
  // to ~16mm. Wrapping everything in one outer scale transform up to a true
  // print-resolution grid (300 DPI's px-per-mm) — while keeping width/height
  // in real mm — makes the file read correctly either way: as exact physical
  // mm for tools that honor the unit, or as a properly-proportioned
  // print-quality raster grid for tools that don't.
  const RESOLUTION_SCALE = 300 / 25.4;
  const viewW = canvasW * RESOLUTION_SCALE;
  const viewH = canvasH * RESOLUTION_SCALE;

  return `<svg width="${canvasW}mm" height="${canvasH}mm" viewBox="0 0 ${viewW} ${viewH}" xmlns="http://www.w3.org/2000/svg">
<g transform="scale(${RESOLUTION_SCALE})">
${elements.join("\n")}
</g>
</svg>`;
}
