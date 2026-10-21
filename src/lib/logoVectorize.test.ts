import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { vectorizeLogo } from "./logoVectorize";

// Builds a synthetic logo: a white margin (stands in for the page
// background) around either one or two solid-color blocks, so the tests
// below can exercise real sharp/potrace tracing without needing a real
// uploaded file.
async function makeLogo(colors: { r: number; g: number; b: number; a?: number }[]): Promise<Buffer> {
  const size = 64;
  const margin = 6;
  const data = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const inMargin = x < margin || x >= size - margin || y < margin || y >= size - margin;
      if (inMargin) {
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
        data[i + 3] = 255;
        continue;
      }
      const bandWidth = (size - margin * 2) / colors.length;
      const band = Math.min(colors.length - 1, Math.floor((x - margin) / bandWidth));
      const c = colors[band];
      data[i] = c.r;
      data[i + 1] = c.g;
      data[i + 2] = c.b;
      data[i + 3] = c.a ?? 255;
    }
  }
  return sharp(data, { raw: { width: size, height: size, channels: 4 } }).png().toBuffer();
}

describe("vectorizeLogo", () => {
  it("still traces a flat single-color silhouette into `ds`, for single-color-ink techniques", async () => {
    const buf = await makeLogo([
      { r: 220, g: 20, b: 20 },
      { r: 20, g: 20, b: 220 },
    ]);
    const result = await vectorizeLogo(buf);
    expect(result.ds.length).toBeGreaterThan(0);
  }, 20000);

  it("traces one layer per real color for a multi-color logo", async () => {
    const buf = await makeLogo([
      { r: 220, g: 20, b: 20 },
      { r: 20, g: 20, b: 220 },
    ]);
    const result = await vectorizeLogo(buf);
    expect(result.layers.length).toBeGreaterThanOrEqual(2);
    for (const layer of result.layers) {
      expect(layer.ds.length).toBeGreaterThan(0);
      expect(layer.color).toMatch(/^#[0-9a-f]{6}$/);
    }
  }, 20000);

  it("produces exactly one layer, in its own real color, for a single-color logo", async () => {
    const buf = await makeLogo([{ r: 10, g: 10, b: 10 }]);
    const result = await vectorizeLogo(buf);
    expect(result.layers.length).toBe(1);
    expect(result.layers[0].color).toBe("#0a0a0a");
  }, 20000);

  // "fijate que en el render se ve bien, y cuando lo genera en svg sale
  // mal" — a deliberately semi-transparent band (standing in for a muted
  // tagline set to reduced opacity, a common design choice) used to be
  // discarded outright by the old `alpha < 200` cutoff: it never got its
  // own color bucket and was skipped by every mask, vanishing from the
  // vector output while still rendering fine as a raster composite.
  it("still traces a deliberately semi-transparent element into its own layer", async () => {
    const buf = await makeLogo([
      { r: 220, g: 20, b: 20, a: 255 },
      { r: 120, g: 120, b: 120, a: 150 },
    ]);
    const result = await vectorizeLogo(buf);
    expect(result.layers.length).toBeGreaterThanOrEqual(2);
  }, 20000);
});
