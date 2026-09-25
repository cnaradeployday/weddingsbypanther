// Crops a data URL image to a rectangle expressed as 0-1 fractions of the
// source image's own natural size — pure enough to unit test the fraction
// math even though the actual pixel work needs a canvas (browser-only).

export type CropRect = { x: number; y: number; width: number; height: number };

export function clampCropRect(rect: CropRect): CropRect {
  const width = Math.min(1, Math.max(0.05, rect.width));
  const height = Math.min(1, Math.max(0.05, rect.height));
  const x = Math.min(1 - width, Math.max(0, rect.x));
  const y = Math.min(1 - height, Math.max(0, rect.y));
  return { x, y, width, height };
}

export function cropRectToPixels(rect: CropRect, naturalWidth: number, naturalHeight: number) {
  return {
    x: Math.round(rect.x * naturalWidth),
    y: Math.round(rect.y * naturalHeight),
    width: Math.round(rect.width * naturalWidth),
    height: Math.round(rect.height * naturalHeight),
  };
}

export function cropImageDataUrl(dataUrl: string, rect: CropRect): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const naturalWidth = img.naturalWidth || img.width;
      const naturalHeight = img.naturalHeight || img.height;
      const px = cropRectToPixels(clampCropRect(rect), naturalWidth, naturalHeight);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, px.width);
      canvas.height = Math.max(1, px.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas not supported"));
        return;
      }
      ctx.drawImage(img, px.x, px.y, px.width, px.height, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}
