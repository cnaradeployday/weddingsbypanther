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

  // "aun le falta calar el interior de las letras... deberia llenar los
  // puntos blancos con color pleno" — a textured/painterly source (not a
  // flat vector originally) can have genuine partial-alpha noise speckled
  // *inside* what's meant to read as solid fill, not just at the edges.
  // Those single-pixel gaps shouldn't trace as real cutouts, but a large,
  // deliberate hole (a letter's counter) must still come through.
  it("closes small interior alpha-noise speckles while keeping a real hole open", async () => {
    const size = 64;
    const margin = 6;
    const data = Buffer.alloc(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        const inMargin = x < margin || x >= size - margin || y < margin || y >= size - margin;
        if (inMargin) {
          data[i] = data[i + 1] = data[i + 2] = data[i + 3] = 255;
          continue;
        }
        // A large, deliberate hole in the middle third — must stay open.
        const inBigHole = x > size * 0.4 && x < size * 0.6 && y > size * 0.4 && y < size * 0.6;
        // Scattered single-pixel speckles of near-zero alpha — noise from
        // a textured source, not real cutouts, and must close up.
        const isSpeckle = !inBigHole && (x + y * 3) % 11 === 0;
        data[i] = 220;
        data[i + 1] = 20;
        data[i + 2] = 20;
        data[i + 3] = inBigHole || isSpeckle ? 0 : 255;
      }
    }
    const buf = await sharp(data, { raw: { width: size, height: size, channels: 4 } }).png().toBuffer();
    const result = await vectorizeLogo(buf);
    expect(result.layers.length).toBe(1);

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
      `<path d="${result.layers[0].ds.join(" ")}" fill="${result.layers[0].color}" fill-rule="evenodd"/></svg>`;
    const { data: raster, info } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const alphaAt = (x: number, y: number) => raster[(y * info.width + x) * 4 + 3];

    // A point inside the speckled-but-meant-to-be-solid region is filled.
    expect(alphaAt(10, 10)).toBeGreaterThan(200);
    // The big, deliberate hole is still open.
    expect(alphaAt(Math.floor(size / 2), Math.floor(size / 2))).toBeLessThan(50);
  }, 20000);

  // "no caló bien el logo en svg" — a gradient wordmark (several large,
  // genuinely distinct colors) can by itself fill most or all of a small
  // color-bucket budget, crowding out any other real color in the same
  // logo (a small separate icon, say) out of every layer entirely, not
  // just de-prioritized.
  it("keeps every real color of a logo with more than 6 distinct colors", async () => {
    const colors = [
      { r: 220, g: 20, b: 20 },
      { r: 220, g: 120, b: 20 },
      { r: 220, g: 200, b: 20 },
      { r: 20, g: 180, b: 20 },
      { r: 20, g: 120, b: 220 },
      { r: 100, g: 20, b: 220 },
      { r: 200, g: 20, b: 180 },
    ];
    const buf = await makeLogo(colors);
    const result = await vectorizeLogo(buf);
    expect(result.layers.length).toBe(colors.length);
  }, 20000);
});
