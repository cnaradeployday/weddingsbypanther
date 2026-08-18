import { readFile } from "node:fs/promises";
import path from "node:path";
import * as opentype from "opentype.js";
import { TEXT_FONTS, type TextFontId } from "./textFonts";

// Print shops need personalization text as true vector outlines ("en
// curvas") rather than an SVG <text> element referencing a font — an
// outline renders identically on any machine, with no font install and no
// substitution risk. sharp/librsvg can only rasterize or emit font-bound
// <text>, so outlining is done directly against the same bundled subset
// font files used for the live preview/composite (see
// personalizationComposite.ts), via opentype.js's glyph path support.
const FONT_FILES: Record<TextFontId, string> = {
  cormorant: "CormorantGaramond-Subset.ttf",
  playfair: "PlayfairDisplay-Subset.ttf",
  greatvibes: "GreatVibes-Subset.ttf",
  montserrat: "Montserrat-Subset.ttf",
  ebgaramond: "EBGaramond-Subset.ttf",
  parisienne: "Parisienne-Subset.ttf",
};

const fontCache = new Map<string, Promise<opentype.Font>>();

function loadFont(fontId: string): Promise<opentype.Font> {
  const id = (TEXT_FONTS.some((f) => f.id === fontId) ? fontId : "cormorant") as TextFontId;
  const file = FONT_FILES[id];
  let cached = fontCache.get(file);
  if (!cached) {
    cached = readFile(path.join(process.cwd(), "public", "fonts", file)).then((buffer) =>
      opentype.parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength))
    );
    fontCache.set(file, cached);
  }
  return cached;
}

// Glyphs are extracted one character at a time rather than shaping the
// whole line through font.getPath(line, ...) — some of the bundled script
// fonts (e.g. Great Vibes) use a GSUB contextual-substitution lookup format
// opentype.js's shaper doesn't implement, which throws when it processes a
// multi-character run. Per-character advance-width layout sacrifices
// ligatures but sidesteps that shaping path entirely, and is what letter-
// spacing already needed here regardless.
function lineAdvanceWidth(font: opentype.Font, line: string, fontSize: number, letterSpacing: number): number {
  const chars = Array.from(line);
  const total = chars.reduce((sum, c) => sum + font.getAdvanceWidth(c, fontSize), 0);
  return chars.length > 1 ? total + letterSpacing * (chars.length - 1) : total;
}

function linePath(font: opentype.Font, line: string, startX: number, baselineY: number, fontSize: number, letterSpacing: number): string {
  const combined = new opentype.Path();
  let x = startX;
  for (const char of Array.from(line)) {
    combined.extend(font.getPath(char, x, baselineY, fontSize));
    x += font.getAdvanceWidth(char, fontSize) + letterSpacing;
  }
  return combined.toPathData(2);
}

// Renders `text` as one outlined path per line, each centered on `cx` with
// its own vertical position from `centerYs`, matching the vertical
// centering buildArtworkImage gets from dominant-baseline="central" on its
// SVG <text> — approximated here from the font's own ascender/descender
// metrics since an outlined path has no baseline concept of its own.
export async function textLinesToPathData(
  lines: string[],
  fontId: string,
  fontSize: number,
  cx: number,
  centerYs: number[],
  letterSpacing = 0
): Promise<string[]> {
  const font = await loadFont(fontId);
  const scale = fontSize / font.unitsPerEm;
  const centerAdjust = ((font.ascender + font.descender) / 2) * scale;
  return lines.map((line, i) => {
    if (!line) return "";
    const width = lineAdvanceWidth(font, line, fontSize, letterSpacing);
    const x = cx - width / 2;
    const baselineY = centerYs[i] + centerAdjust;
    return linePath(font, line, x, baselineY, fontSize, letterSpacing);
  });
}
