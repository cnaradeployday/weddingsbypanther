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

  // Follow-up to "no esta calando las letras adentro": a soft drop shadow's
  // visible "spill" (the sliver that extends past the shape casting it, onto
  // bare background) fades from its own real color down to fully
  // transparent — faint pixels there are genuinely closer to the background
  // than to any real ink color, and too sparse on their own to have earned a
  // bucket in dominantColors. Before this fix, every opaque pixel was forced
  // into whichever ink bucket was nearest regardless of how far away, so
  // those fading shadow pixels scattered into an unrelated nearby color
  // (here, a solid block's own ink) as visible speckle instead of fading out
  // like the rest of the shadow already does via its own alpha.
  it("excludes a fading shadow's background-ward edge from an unrelated color's layer", async () => {
    const size = 400;
    const data = Buffer.alloc(size * size * 4);
    const set = (x: number, y: number, r: number, g: number, b: number, a = 255) => {
      const i = (y * size + x) * 4;
      data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = a;
    };
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) set(x, y, 255, 255, 255, 255);
    // A big solid-ink block (plenty of area, so it easily clears minShare).
    for (let y = 20; y < 220; y++) for (let x = 20; x < 150; x++) set(x, y, 128, 190, 70);
    // Another solid block in a second real color, same reasoning.
    for (let y = 20; y < 140; y++) for (let x = 260; x < 380; x++) set(x, y, 64, 67, 81);
    // The shadow's thin, fading spill — small enough on its own to miss
    // dominantColors' minShare, blending from a real gray down to fully
    // transparent (closer to background than to either ink color above).
    for (let y = 220; y < 260; y++) {
      for (let x = 20; x < 150; x++) {
        const t = (y - 220) / 40;
        const alpha = Math.round(255 * (1 - t) * 0.6);
        if (alpha > 0) set(x, y, 90, 90, 95, alpha);
      }
    }
    const buf = await sharp(data, { raw: { width: size, height: size, channels: 4 } }).png().toBuffer();
    const result = await vectorizeLogo(buf);

    const hexToRgb = (hex: string) => ({
      r: parseInt(hex.slice(1, 3), 16),
      g: parseInt(hex.slice(3, 5), 16),
      b: parseInt(hex.slice(5, 7), 16),
    });
    for (const layer of result.layers) {
      const c = hexToRgb(layer.color);
      const distToShadow = (c.r - 90) ** 2 + (c.g - 90) ** 2 + (c.b - 95) ** 2;
      if (distToShadow < 2000) continue; // this is the shadow's own layer
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${result.width}" height="${result.height}">` +
        `<path d="${layer.ds.join(" ")}" fill="${layer.color}" fill-rule="evenodd"/></svg>`;
      const { data: raster, info } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      let covered = 0, total = 0;
      for (let y = 220; y < 260; y++) {
        for (let x = 20; x < 150; x++) {
          total++;
          const i = (y * info.width + x) * 4;
          if (raster[i + 3] > 100) covered++;
        }
      }
      expect(covered / total).toBeLessThan(0.05);
    }
  }, 20000);

  // "seguimos sin lograr el degrade, podemos aumentar la cantidad de
  // colores?" — raising maxColors alone (6→10→24 in earlier rounds) wasn't
  // the bottleneck for a genuine continuous gradient (not the earlier
  // flat-banded "MOMENT" wordmark, but a real radial highlight on a glossy
  // icon): dominantColors' own color-space quantization grid (`STEP`) caps
  // how many distinct buckets a smooth gradient can ever produce before
  // maxColors gets a say. This asserts a real gradient actually produces
  // meaningfully more bands than the old STEP value allowed, not just that
  // maxColors is numerically bigger.
  it("produces meaningfully more bands for a genuine continuous gradient, not just a higher maxColors ceiling", async () => {
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
        const t = (x - margin) / (size - margin * 2);
        data[i] = Math.round(220 + (255 - 220) * (1 - t));
        data[i + 1] = Math.round(20 + (255 - 20) * (1 - t));
        data[i + 2] = Math.round(20 + (255 - 20) * (1 - t));
        data[i + 3] = 255;
      }
    }
    const buf = await sharp(data, { raw: { width: size, height: size, channels: 4 } }).png().toBuffer();
    const result = await vectorizeLogo(buf);
    expect(result.layers.length).toBeGreaterThanOrEqual(8);
  }, 20000);
});
