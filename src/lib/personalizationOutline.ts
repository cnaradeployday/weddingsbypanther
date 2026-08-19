import { monogramSvgInner } from "./monograms";
import { frameSvgInner } from "./frameTemplates";
import { fitTextFontSize, estimateTextWidth, textLineCount } from "./textFit";
import { textLinesToPathData } from "./textOutline";
import type { ElemKey } from "./personalizationComposite";

// Print-ready companion to buildArtworkImage (personalizationComposite.ts):
// same layout math (positions, font sizing, frame padding), but names/date
// come out as real vector path outlines instead of font-bound <text>, and
// there's no photo background or raster logo — just the artwork a print
// shop cuts/engraves/etches from. Sized in real millimeters (the product's
// print zone dimensions) so opening the file in any vector editor shows it
// at true physical size.
export async function buildOutlineArtworkSvg({
  canvasW,
  canvasH,
  positions,
  names,
  date,
  monogram,
  frame = "",
  textFont = "",
  inkColor,
  fontScale = {},
  rotations = {},
}: {
  canvasW: number;
  canvasH: number;
  positions: Record<string, { x: number; y: number }>;
  names: string;
  date: string;
  monogram: string;
  frame?: string;
  textFont?: string;
  inkColor: string;
  fontScale?: Partial<Record<Exclude<ElemKey, "logo">, number>>;
  rotations?: Partial<Record<ElemKey, number>>;
}): Promise<string> {
  const pos = (key: string, fallback: { x: number; y: number }) => positions[key] ?? fallback;
  const elements: string[] = [];

  if (monogram.trim()) {
    const p = pos("monogram", { x: 50, y: 15 });
    const cx = (p.x / 100) * canvasW;
    const cy = (p.y / 100) * canvasH;
    const size = canvasH * 0.14 * (fontScale.monogram ?? 1);
    const deg = rotations.monogram ?? 0;
    elements.push(
      `<g transform="translate(${cx} ${cy}) rotate(${deg}) scale(${size / 24}) translate(-12 -12)">${monogramSvgInner(
        monogram,
        inkColor
      )}</g>`
    );
  }

  if (names.trim()) {
    const p = pos("names", { x: 50, y: 65 });
    const cx = (p.x / 100) * canvasW;
    const cy = (p.y / 100) * canvasH;
    const trimmed = names.trim();
    const lines = trimmed.split("\n").map((l) => l.trim());
    const lineCount = textLineCount(trimmed);
    const fontSize = fitTextFontSize(trimmed, canvasH * 0.11 * (fontScale.names ?? 1), canvasW * 0.92);
    const lineHeight = fontSize * 1.25;

    if (frame.trim()) {
      const textW = estimateTextWidth(trimmed, fontSize);
      const textH = lineHeight * lineCount;
      const padX = fontSize * 0.7;
      const padY = fontSize * 0.45;
      const boxW = textW + padX * 2;
      const boxH = textH + padY * 2;
      const frameDeg = rotations.names ?? 0;
      elements.push(
        `<g transform="translate(${cx} ${cy}) rotate(${frameDeg}) scale(${boxW / 200} ${boxH / 90}) translate(-100 -45)">${frameSvgInner(
          frame.trim(),
          inkColor
        )}</g>`
      );
    }

    const firstLineCenterY = cy - ((lineCount - 1) / 2) * lineHeight;
    const centerYs = lines.map((_, i) => firstLineCenterY + i * lineHeight);
    const pathsData = await textLinesToPathData(lines, textFont, fontSize, cx, centerYs);
    const deg = rotations.names ?? 0;
    const group = pathsData
      .filter(Boolean)
      .map((d) => `<path d="${d}" fill="${inkColor}" />`)
      .join("");
    if (group) {
      elements.push(`<g${deg ? ` transform="rotate(${deg} ${cx} ${cy})"` : ""}>${group}</g>`);
    }
  }

  if (date.trim()) {
    const p = pos("date", { x: 50, y: 82 });
    const cx = (p.x / 100) * canvasW;
    const cy = (p.y / 100) * canvasH;
    const trimmed = date.trim();
    const fontSize = fitTextFontSize(trimmed, canvasH * 0.05 * (fontScale.date ?? 1), canvasW * 0.92);
    const [d] = await textLinesToPathData([trimmed], textFont, fontSize, cx, [cy], fontSize * 0.08);
    const deg = rotations.date ?? 0;
    if (d) {
      elements.push(
        `<g${deg ? ` transform="rotate(${deg} ${cx} ${cy})"` : ""}><path d="${d}" fill="${inkColor}" /></g>`
      );
    }
  }

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
