// Neither the browser (CSS) nor the server (SVG via sharp/librsvg) exposes a
// cheap way to measure real glyph metrics before rendering text into a fixed
// box, so both sides use the same rough serif average-character-width
// estimate to cap font-size to the available width. It's an approximation,
// not exact shaping, but it keeps long names/dates from overflowing the
// print area instead of letting them run past its edges unconstrained.
const AVG_CHAR_WIDTH_RATIO = 0.56;

// Names/event text can span multiple lines (the customer presses Enter) —
// width fitting only cares about the widest line, since that's what
// determines whether the block overflows horizontally.
function longestLine(text: string): string {
  return text.split("\n").reduce((longest, line) => (line.length > longest.length ? line : longest), "");
}

export function textLineCount(text: string): number {
  return Math.max(1, text.split("\n").length);
}

export function fitTextFontSize(text: string, desiredSize: number, availableWidth: number): number {
  const line = longestLine(text);
  if (!line || availableWidth <= 0) return desiredSize;
  const estWidth = line.length * AVG_CHAR_WIDTH_RATIO * desiredSize;
  if (estWidth <= availableWidth) return desiredSize;
  return Math.max(6, availableWidth / (line.length * AVG_CHAR_WIDTH_RATIO));
}

// Same rough estimate, the other direction — used to size a decorative
// frame around text that's already been fit to a font size, since the
// server has no real text-measurement API to size the frame against.
// Multi-line text is measured by its widest line, same as fitTextFontSize.
export function estimateTextWidth(text: string, fontSize: number): number {
  return longestLine(text).length * AVG_CHAR_WIDTH_RATIO * fontSize;
}
