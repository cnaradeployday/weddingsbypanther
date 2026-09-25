import { describe, it, expect } from "vitest";
import { keyOutWhiteBackground, keyOutWhiteBackgroundConnectedToEdge } from "./backgroundKey";

// Builds a flat RGBA buffer for a WxH image from a 2D grid of "W" (white)
// or "K" (black), all fully opaque — enough to exercise the flood-fill
// logic without needing a real image/canvas.
function buildImage(rows: string[]): { data: Uint8ClampedArray; width: number; height: number } {
  const height = rows.length;
  const width = rows[0].length;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const isWhite = rows[y][x] === "W";
      data[i] = isWhite ? 255 : 0;
      data[i + 1] = isWhite ? 255 : 0;
      data[i + 2] = isWhite ? 255 : 0;
      data[i + 3] = 255;
    }
  }
  return { data, width, height };
}

describe("keyOutWhiteBackground (All white)", () => {
  it("keys out every near-white pixel, including an enclosed hole", () => {
    // A ring of black with a white "hole" in the middle (like the counter
    // of a letter O), surrounded by a white background.
    const { data } = buildImage(["WWWWW", "WKKKW", "WKWKW", "WKKKW", "WWWWW"]);
    keyOutWhiteBackground(data);
    const centerAlpha = data[(2 * 5 + 2) * 4 + 3];
    expect(centerAlpha).toBe(0);
  });
});

describe("keyOutWhiteBackgroundConnectedToEdge (Background only)", () => {
  it("keys out the border-connected white background", () => {
    const { data, width, height } = buildImage(["WWWWW", "WKKKW", "WKWKW", "WKKKW", "WWWWW"]);
    keyOutWhiteBackgroundConnectedToEdge(data, width, height);
    const cornerAlpha = data[0 * 4 + 3];
    expect(cornerAlpha).toBe(0);
  });

  it("leaves an enclosed white hole intact, unlike All white", () => {
    const { data, width, height } = buildImage(["WWWWW", "WKKKW", "WKWKW", "WKKKW", "WWWWW"]);
    keyOutWhiteBackgroundConnectedToEdge(data, width, height);
    const centerAlpha = data[(2 * width + 2) * 4 + 3];
    expect(centerAlpha).toBe(255);
  });

  it("does not touch opaque (non-white) pixels", () => {
    const { data, width, height } = buildImage(["WWWWW", "WKKKW", "WKWKW", "WKKKW", "WWWWW"]);
    keyOutWhiteBackgroundConnectedToEdge(data, width, height);
    const ringAlpha = data[(1 * width + 1) * 4 + 3];
    expect(ringAlpha).toBe(255);
  });

  it("no-ops on an image that already has real transparency", () => {
    const { data, width, height } = buildImage(["WWW", "WKW", "WWW"]);
    data[3] = 0; // give the first pixel real (non-255) alpha
    const changed = keyOutWhiteBackgroundConnectedToEdge(data, width, height);
    expect(changed).toBe(false);
  });
});
