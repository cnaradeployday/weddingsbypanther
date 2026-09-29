"use client";

// Downscales an image data URL to a small square-bounded thumbnail, for
// showing a recognizable preview of a saved logo in a drafts/versions list
// without keeping the full-resolution upload around for every entry in that
// list (RecoveryModal's `list()` call is meant to stay cheap — see
// designStorage.ts). Keeps the source's own aspect ratio (letterboxed into
// a maxSize×maxSize canvas), matching how the logo itself renders via
// object-contain everywhere else in the editor.
export function generateThumbnail(dataUrl: string, maxSize = 96): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      if (!w || !h) {
        reject(new Error("Image has no size"));
        return;
      }
      const scale = Math.min(1, maxSize / Math.max(w, h));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(w * scale));
      canvas.height = Math.max(1, Math.round(h * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas not supported"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}
