"use client";

import { useState } from "react";
import { fileToDataUrl } from "@/lib/dataUrl";
import type { LogoRemoveWhiteMode } from "./types";

// A generous technical safety cap, not a business rule — no maximum upload
// size is defined anywhere in the product/technique configuration
// (DISCOVERY.md), so this only guards against a pathologically large file
// freezing the tab while it's read/decoded, not a configured limit.
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

const REMOVE_WHITE_OPTIONS: { id: LogoRemoveWhiteMode; label: string; hint: string }[] = [
  { id: "never", label: "Never", hint: "Keep the logo exactly as uploaded." },
  { id: "background", label: "Background only", hint: "Removes white around the edges, keeps white details inside the logo." },
  { id: "all", label: "All white", hint: "Removes every near-white area, including inside letters." },
];

export function LogoToolPanel({
  preview,
  onUpload,
  onReplace,
  onRemove,
  onCrop,
  removeWhiteMode,
  onChangeRemoveWhiteMode,
  isLowRes,
  sizeLabel,
  detectedColors,
}: {
  preview: string | null;
  onUpload: (file: File, dataUrl: string) => void;
  onReplace: (file: File, dataUrl: string) => void;
  onRemove: () => void;
  onCrop: () => void;
  removeWhiteMode: LogoRemoveWhiteMode;
  onChangeRemoveWhiteMode: (mode: LogoRemoveWhiteMode) => void;
  isLowRes: boolean;
  sizeLabel: string | null;
  detectedColors: { hex: string; pct: number }[];
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File, mode: "upload" | "replace") => {
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("That file isn't an image. Upload a PNG, JPG, SVG, or similar image file.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(`That file is too large (max ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB).`);
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      if (mode === "upload") onUpload(file, dataUrl);
      else onReplace(file, dataUrl);
    } catch {
      setError("Couldn't read that file. Try a different one.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <h2 className="font-serif text-2xl">Logo</h2>

      {!preview && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted">
            Accepts PNG, JPG, SVG, and most other image formats, up to {Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB.
            A higher-resolution file prints more sharply.
          </p>
          <label className="flex items-center justify-center gap-2 h-14 rounded-lg border-2 border-dashed border-line cursor-pointer text-sm text-dark">
            {uploading ? "Uploading…" : "Upload a logo"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file, "upload");
                e.target.value = "";
              }}
            />
          </label>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      {preview && (
        <>
          <div className="flex items-center gap-3">
            <span className="relative h-16 w-16 rounded-lg overflow-hidden border border-line bg-white shrink-0">
              {/* Logo already validated as an image; a plain <img> avoids
                  next/image's remote-loader requirements for a data: URL. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="" className="absolute inset-0 w-full h-full object-contain" />
            </span>
            <div className="flex flex-col gap-1.5 text-xs">
              <label className="text-dark font-medium underline underline-offset-2 cursor-pointer">
                {uploading ? "Uploading…" : "Replace"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file, "replace");
                    e.target.value = "";
                  }}
                />
              </label>
              <button type="button" onClick={onCrop} className="text-left text-dark font-medium underline underline-offset-2">
                Crop
              </button>
              <button type="button" onClick={onRemove} className="text-left text-terracotta-dark font-medium">
                Remove
              </button>
            </div>
          </div>

          {sizeLabel && <p className="text-xs text-muted">{sizeLabel}</p>}
          {isLowRes && (
            <p className="text-xs text-red-600">
              ⚠️ This logo is low resolution for the size it&apos;s being printed at — it may look blurry or pixelated on the finished product.
            </p>
          )}

          <div className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-wide text-muted">Remove white</span>
            <div className="flex flex-col gap-1.5">
              {REMOVE_WHITE_OPTIONS.map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 cursor-pointer ${
                    removeWhiteMode === opt.id ? "border-dark bg-cream" : "border-line"
                  }`}
                >
                  <input
                    type="radio"
                    name="remove-white-mode"
                    checked={removeWhiteMode === opt.id}
                    onChange={() => onChangeRemoveWhiteMode(opt.id)}
                    className="mt-0.5"
                  />
                  <span className="flex flex-col">
                    <span className="text-sm font-medium">{opt.label}</span>
                    <span className="text-xs text-muted">{opt.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {detectedColors.length > 0 && (
            <div className="pt-3 border-t border-line">
              <p className="text-xs text-muted mb-1.5">Colors detected in this logo</p>
              <div className="flex flex-wrap gap-2">
                {detectedColors.map((c) => (
                  <span key={c.hex} className="inline-flex items-center gap-1.5 text-[11px] rounded-full border border-line px-2 py-1">
                    <span className="h-3 w-3 rounded-full border border-line shrink-0" style={{ backgroundColor: c.hex }} />
                    {c.hex.toUpperCase()} · {c.pct}%
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-line">
            <p className="text-xs text-muted">
              Automatic background removal (for photos, not just flat white) isn&apos;t available yet — the
              in-browser library considered for it (@imgly/background-removal) is AGPL-licensed, which isn&apos;t
              compatible with this app, and no adequately free, production-quality alternative was found.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
