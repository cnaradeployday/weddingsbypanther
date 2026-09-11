"use client";

export type DetectedColor = { hex: string; pct: number };

// Samples the uploaded logo's opaque pixels and buckets them into a small
// palette so the customer and back office can see at a glance what inks a
// multi-color print would actually need. Skips transparent/near-transparent
// pixels (a keyed-out background, or real alpha) so the palette reflects
// only the artwork itself, not the canvas behind it.
export function detectLogoColors(dataUrl: string, maxColors = 6): Promise<DetectedColor[]> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      // Downscale for speed — a palette doesn't need full resolution, just
      // enough samples to be representative.
      const longest = Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height, 1);
      const scale = Math.min(1, 200 / longest);
      canvas.width = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
      canvas.height = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas not supported"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

      const STEP = 24; // quantization bucket size per channel — merges near-identical shades
      const buckets = new Map<string, { r: number; g: number; b: number; count: number }>();
      let opaqueCount = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 200) continue;
        opaqueCount++;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const key = `${Math.round(r / STEP)}-${Math.round(g / STEP)}-${Math.round(b / STEP)}`;
        const bucket = buckets.get(key);
        if (bucket) {
          bucket.r += r;
          bucket.g += g;
          bucket.b += b;
          bucket.count++;
        } else {
          buckets.set(key, { r, g, b, count: 1 });
        }
      }
      if (opaqueCount === 0) {
        resolve([]);
        return;
      }

      const top = [...buckets.values()].sort((a, b) => b.count - a.count).slice(0, maxColors);
      resolve(
        top.map((b) => ({
          hex: rgbToHex(Math.round(b.r / b.count), Math.round(b.g / b.count), Math.round(b.b / b.count)),
          pct: Math.round((b.count / opaqueCount) * 100),
        }))
      );
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
