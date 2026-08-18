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

  return `<svg width="${canvasW}mm" height="${canvasH}mm" viewBox="0 0 ${canvasW} ${canvasH}" xmlns="http://www.w3.org/2000/svg">
${elements.join("\n")}
</svg>`;
}
