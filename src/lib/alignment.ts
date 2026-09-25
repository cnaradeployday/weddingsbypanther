// Align-to-print-area (EDIT-15). Aligns against the print area's bounding
// box (the same zoneBox every position is already stored relative to, and
// what the on-screen guides/measurements use) rather than attempting exact
// alignment to a tilted quad's true edges — a documented simplification:
// a "snap to a nice position" convenience, not a hard boundary (BUG-03's
// containment already guarantees the element stays inside the real quad
// regardless of where alignment puts it).

export type HorizontalAlign = "left" | "center" | "right";
export type VerticalAlign = "top" | "middle" | "bottom";

// halfWidthPct/halfHeightPct: the element's current half-size, expressed as
// a percentage of the zoneBox (the same units `positions` are stored in).
export function alignHorizontal(align: HorizontalAlign, halfWidthPct: number): number {
  switch (align) {
    case "left":
      return halfWidthPct;
    case "right":
      return 100 - halfWidthPct;
    case "center":
      return 50;
  }
}

export function alignVertical(align: VerticalAlign, halfHeightPct: number): number {
  switch (align) {
    case "top":
      return halfHeightPct;
    case "bottom":
      return 100 - halfHeightPct;
    case "middle":
      return 50;
  }
}
