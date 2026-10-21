"use client";

// Rasterizes the first page of an uploaded PDF — or a modern Illustrator
// .ai file, which Illustrator saves as PDF-compatible by default, so it
// opens the same way here — into a PNG data URL, entirely in the browser.
// pdf.js already ships its own renderer built on the native <canvas> API,
// so this needs no server-side native dependency (no Ghostscript, no
// node-canvas) at all — real PostScript .eps files aren't PDF-compatible
// and aren't handled by this path.
export function isPdfLikeFile(file: File): boolean {
  if (file.type === "application/pdf") return true;
  const name = file.name.toLowerCase();
  return name.endsWith(".pdf") || name.endsWith(".ai");
}

export async function renderPdfFirstPageToDataUrl(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  const page = await pdf.getPage(1);

  // A PDF's own default viewport is 72dpi — far too coarse for a logo
  // that's about to be traced into print-ready curves (vectorizeLogo) or
  // printed directly. Scale up toward a generous max dimension instead of
  // a fixed multiplier, so a huge artboard doesn't produce an enormous
  // canvas while a small one (the common case for a logo) still renders
  // plenty sharp.
  const baseViewport = page.getViewport({ scale: 1 });
  const maxDim = 2000;
  const scale = Math.min(6, Math.max(1, maxDim / Math.max(baseViewport.width, baseViewport.height)));
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas.toDataURL("image/png");
}
