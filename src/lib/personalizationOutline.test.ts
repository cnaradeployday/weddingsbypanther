import { describe, it, expect } from "vitest";
import { buildOutlineArtworkSvg, type OutlineLayoutParams } from "./personalizationOutline";

const baseParams: OutlineLayoutParams = {
  canvasW: 60,
  canvasH: 30,
  positions: {},
  names: "",
  date: "",
  monogram: "",
  inkColor: "#000000",
};

// "y por otro lado fijate que no esta calando las letras adentro cuando
// descargo el svg" — a logo's traced path data (logoVectorize.ts, via
// potrace) winds a letter's outer boundary and its inner counter (the hole
// in an "A", "O", "P"...) the *same* direction, which only renders as a
// hole under fill-rule="evenodd". Left at the SVG default (nonzero), the
// counter fills in solid — this was missing on both the downloadable SVG
// and the vector PDF, even though the exact same path data renders a real
// hole correctly wherever it's actually tested against (logoVectorize's own
// test suite), because nothing else re-renders it as an SVG path at all.
describe("buildOutlineArtworkSvg", () => {
  it("marks a logo layer's path fill-rule=evenodd so letter counters render as real holes", async () => {
    // A simple "donut": an outer 10x10 square and an inner 4x4 square hole,
    // both wound the same direction (clockwise) — exactly how potrace
    // outputs a letter's outer contour and its counter.
    const donut = "M0,0 L10,0 L10,10 L0,10 Z M3,3 L7,3 L7,7 L3,7 Z";
    const svg = await buildOutlineArtworkSvg({
      ...baseParams,
      logoVector: { ds: [], width: 10, height: 10, layers: [{ ds: [donut], color: "#ff0000" }] },
    });
    expect(svg).toContain(`<path d="${donut}" fill="#ff0000" fill-rule="evenodd" />`);
  });

  it("does not force evenodd onto text paths, which would punch false holes where overlapping glyphs meet", async () => {
    const svg = await buildOutlineArtworkSvg({ ...baseParams, names: "Hi" });
    const textPaths = Array.from(svg.matchAll(/<path d="([^"]+)" fill="[^"]*"( fill-rule="evenodd")? \/>/g));
    expect(textPaths.length).toBeGreaterThan(0);
    for (const match of textPaths) {
      expect(match[2]).toBeUndefined();
    }
  }, 15000);
});
