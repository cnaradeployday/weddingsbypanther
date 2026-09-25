"use client";

import { keyOutWhiteBackground, keyOutWhiteBackgroundConnectedToEdge } from "./backgroundKey";
import type { LogoRemoveWhiteMode } from "@/components/customizer/types";

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

// Removes a flat white background from the logo exactly as uploaded, with no
// recoloring — a standalone action for a customer/admin who wants a
// transparent logo under a full-color technique, independent of the
// automatic silhouette flattening a single-color technique triggers via
// recolorLogoToSolid above. keyOutWhiteBackground already no-ops when the
// image has no white to key or already carries real transparency, so this
// safely returns the original data URL unchanged in that case.
export function removeLogoBackground(dataUrl: string): Promise<string> {
  return removeLogoBackgroundByMode(dataUrl, "all");
}

// EDIT-11's three "Remove white" options: Never (return the upload
// untouched), Background only (key just the region connected to the
// image's outer edge, preserving white fully enclosed inside the
// artwork), All white (the original, more aggressive behavior — every
// near-white pixel anywhere).
export function removeLogoBackgroundByMode(dataUrl: string, mode: LogoRemoveWhiteMode): Promise<string> {
  if (mode === "never") return Promise.resolve(dataUrl);
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
      const changed =
        mode === "background"
          ? keyOutWhiteBackgroundConnectedToEdge(imageData.data, canvas.width, canvas.height)
          : keyOutWhiteBackground(imageData.data);
      if (!changed) {
        resolve(dataUrl);
        return;
      }
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}
