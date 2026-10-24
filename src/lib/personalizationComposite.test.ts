import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { buildArtworkImage, compositePersonalization, type ImagePayload } from "./personalizationComposite";

async function solidPhoto(r: number, g: number, b: number, w = 200, h = 250): Promise<ImagePayload> {
  const buf = await sharp({ create: { width: w, height: h, channels: 3, background: { r, g, b } } })
    .png()
    .toBuffer();
  return { data: buf.toString("base64"), mimeType: "image/png" };
}

async function pixelAt(payload: ImagePayload, x: number, y: number) {
  const { data, info } = await sharp(Buffer.from(payload.data, "base64"))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const i = (y * info.width + x) * info.channels;
  return { r: data[i], g: data[i + 1], b: data[i + 2] };
}

// The most-green pixel in a small neighborhood — avoids landing on a
// glyph's anti-aliased edge or a gap between letters, which a single exact
// pixel sample is prone to.
async function mostGreenNear(payload: ImagePayload, cx: number, cy: number, radius = 15) {
  const { data, info } = await sharp(Buffer.from(payload.data, "base64"))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let best = { r: 0, g: -1, b: 0 };
  for (let y = cy - radius; y <= cy + radius; y++) {
    for (let x = cx - radius; x <= cx + radius; x++) {
      if (x < 0 || y < 0 || x >= info.width || y >= info.height) continue;
      const i = (y * info.width + x) * info.channels;
      if (data[i + 1] > best.g) best = { r: data[i], g: data[i + 1], b: data[i + 2] };
    }
  }
  return best;
}

// "funciona bien con el color WHITE del cuaderno... como que se arregló
// para un solo color?" — a full-color/opaque-ink technique's printed
// design should show its own real colors regardless of the product's own
// color, the same way a sticker does. Multiply-blending it (correct only
// for a single-ink mark that genuinely lets the material show through)
// darkens and hue-shifts every printed color by exactly how dark the
// product is — invisible on white, a visible dark smear on anything else.
describe("compositePersonalization blend mode", () => {
  const box = { left: 50, top: 50, width: 100, height: 100 };
  const canvasW = 100;
  const canvasH = 100;

  it("keeps a full-color design's true colors on a dark product (singleColorInk: false → 'over')", async () => {
    const darkPhoto = await solidPhoto(20, 20, 22);
    const artwork = await buildArtworkImage({
      canvasW,
      canvasH,
      logoImage: null,
      positions: { names: { x: 50, y: 50 } },
      names: "Hi",
      date: "",
      monogram: "",
      inkColor: "#00ff00",
      transparentBg: true,
    });
    const result = await compositePersonalization(darkPhoto, artwork, box, canvasW, canvasH, "over");
    // A point clearly off the text, inside the print box, should still
    // show the real (dark) photo through the transparent canvas.
    const blank = await pixelAt(result, 55, 55);
    expect(blank).toEqual({ r: 20, g: 20, b: 22 });
    // The green ink itself should read close to true green, not darkened
    // toward the near-black photo underneath it. The "names" text is
    // centered in canvas-local space (50, 50) — box.left/top (50, 50) must
    // be added to land on it in the composited photo's own coordinates.
    const ink = await mostGreenNear(result, box.left + 50, box.top + 50);
    expect(ink.g).toBeGreaterThan(150);
    expect(ink.r).toBeLessThan(100);
  });

  it("still multiplies (darkens) for a single-color-ink technique (singleColorInk: true, the default)", async () => {
    const darkPhoto = await solidPhoto(20, 20, 22);
    const artwork = await buildArtworkImage({
      canvasW,
      canvasH,
      logoImage: null,
      positions: {},
      names: "",
      date: "",
      monogram: "",
      inkColor: "#1a1a1a",
      // transparentBg left at its default (false) — the old opaque-white
      // canvas multiply relies on.
    });
    const result = await compositePersonalization(darkPhoto, artwork, box, canvasW, canvasH, "multiply");
    // White canvas * dark photo under multiply reproduces the photo
    // unchanged (white is the identity) — same as before this fix.
    const blank = await pixelAt(result, 55, 55);
    expect(blank).toEqual({ r: 20, g: 20, b: 22 });
  });
});
