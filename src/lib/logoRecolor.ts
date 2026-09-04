"use client";

import { keyOutWhiteBackground } from "./backgroundKey";

// Flattens an uploaded logo into a solid silhouette filled with `hex`,
// keeping its original alpha shape — how a one-color print/engrave/
// embroider technique actually reproduces a multi-color upload. Draws the
// source image to a canvas, keys out a flat white background into
// transparency when the source has no real alpha of its own (a JPG, or a
// PNG exported "flattened" onto white — otherwise there'd be nothing to key
// off and the fill would cover the whole rectangle), then paints the fill
// color only where the image is still opaque (globalCompositeOperation
// "source-in"), so the result traces the logo's true silhouette.
export function recolorLogoToSolid(dataUrl: string, hex: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas not supported"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      keyOutWhiteBackground(imageData.data);
      ctx.putImageData(imageData, 0, 0);
      ctx.globalCompositeOperation = "source-in";
      ctx.fillStyle = hex;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}
