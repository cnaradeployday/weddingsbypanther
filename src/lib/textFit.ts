// Neither the browser (CSS) nor the server (SVG via sharp/librsvg) exposes a
// cheap way to measure real glyph metrics before rendering text into a fixed
// box, so both sides use the same rough serif average-character-width
// estimate to cap font-size to the available width. It's an approximation,
// not exact shaping, but it keeps long names/dates from overflowing the
// print area instead of letting them run past its edges unconstrained.
const AVG_CHAR_WIDTH_RATIO = 0.56;

export function fitTextFontSize(text: string, desiredSize: number, availableWidth: number): number {
  if (!text || availableWidth <= 0) return desiredSize;
  const estWidth = text.length * AVG_CHAR_WIDTH_RATIO * desiredSize;
  if (estWidth <= availableWidth) return desiredSize;
  return Math.max(6, availableWidth / (text.length * AVG_CHAR_WIDTH_RATIO));
}
