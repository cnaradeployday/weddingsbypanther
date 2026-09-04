"use client";

// Flattens an uploaded logo into a solid silhouette filled with `hex`,
// keeping its original alpha shape — how a one-color print/engrave/
// embroider technique actually reproduces a multi-color upload. Draws the
// source image to a canvas, then paints the fill color only where the
// image already had opaque pixels (globalCompositeOperation "source-in"),
// so a transparent-background PNG traces its true silhouette; a fully
// opaque source (e.g. a flattened JPG) will fill edge-to-edge, since there's
// no transparency to key off — an inherent limit of alpha-based silhouetting,
// not a bug.
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
      ctx.globalCompositeOperation = "source-in";
      ctx.fillStyle = hex;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}
