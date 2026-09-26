"use client";

import { useState } from "react";
import { fileToDataUrl } from "@/lib/dataUrl";
import { nearestPantone } from "@/lib/pantoneMatch";
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
  processing,
  selectedInkColor,
  onSelectInkColor,
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
  // True while a background-removal mode change is being computed (EDIT-11)
  // — the flood-fill runs on the full-resolution logo and can take a moment.
  processing?: boolean;
  // The order's current ink color (only meaningful when the technique lets
  // the customer choose one) — lets a detected color show as "already
  // selected." Omitted entirely (no tap-to-select) when the technique has
  // no choosable ink at all (e.g. laser engraving).
  selectedInkColor?: string | null;
  onSelectInkColor?: (hex: string) => void;
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
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-serif text-[22px]" style={{ color: "var(--pc-ink-950)" }}>
          Logo
        </h2>
        <p className="text-sm" style={{ color: "var(--pc-ink-500)" }}>
          Higher-resolution files print more sharply.
        </p>
      </div>

      {!preview && (
        <label
          className="flex-1 min-h-[160px] rounded-2xl border-[1.5px] border-dashed flex flex-col items-center justify-center gap-2.5 cursor-pointer text-[15px] transition-colors"
          style={{ borderColor: "var(--pc-ink-200)", background: "var(--pc-ink-50)", color: "var(--pc-ink-700)" }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 15V3" />
            <path d="m7 8 5-5 5 5" />
            <path d="M20 15v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4" />
          </svg>
          {uploading ? "Uploading…" : "Upload a logo"}
          <span className="text-xs" style={{ color: "var(--pc-ink-400)" }}>
            Drag here or click · PNG, JPG, SVG · max {Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB
          </span>
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
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      {preview && (
        <>
          <div className="flex items-center gap-3">
            <span className="relative h-16 w-16 rounded-2xl overflow-hidden bg-white shrink-0" style={{ border: "1px solid var(--pc-ink-100)" }}>
              {/* Logo already validated as an image; a plain <img> avoids
                  next/image's remote-loader requirements for a data: URL. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="" className="absolute inset-0 w-full h-full object-contain" />
            </span>
            <div className="flex flex-col gap-1.5 text-xs">
              <label className="font-medium underline underline-offset-2 cursor-pointer" style={{ color: "var(--pc-ink-950)" }}>
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
              <button type="button" onClick={onCrop} className="text-left font-medium underline underline-offset-2" style={{ color: "var(--pc-ink-950)" }}>
                Crop
              </button>
              <button type="button" onClick={onRemove} className="text-left font-medium" style={{ color: "var(--pc-danger)" }}>
                Remove
              </button>
            </div>
          </div>

          {sizeLabel && (
            <p className="text-xs" style={{ color: "var(--pc-ink-500)" }}>
              {sizeLabel}
            </p>
          )}
          {isLowRes && (
            <p className="text-xs" style={{ color: "var(--pc-danger)" }}>
              ⚠️ This logo is low resolution for the size it&apos;s being printed at — it may look blurry or pixelated on the finished product.
            </p>
          )}

          <div className="flex flex-col gap-2">
            <span className="text-[11px] tracking-[0.14em] uppercase" style={{ color: "var(--pc-ink-500)" }}>
              Remove white{processing ? " · Processing…" : ""}
            </span>
            <div className="flex flex-col gap-1.5">
              {REMOVE_WHITE_OPTIONS.map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-start gap-2.5 rounded-2xl border px-3 py-2.5 ${processing ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                  style={{
                    borderColor: removeWhiteMode === opt.id ? "var(--color-terracotta)" : "var(--pc-ink-200)",
                    background: removeWhiteMode === opt.id ? "var(--pc-ink-50)" : "transparent",
                  }}
                >
                  <input
                    type="radio"
                    name="remove-white-mode"
                    checked={removeWhiteMode === opt.id}
                    disabled={processing}
                    onChange={() => onChangeRemoveWhiteMode(opt.id)}
                    className="mt-0.5"
                  />
                  <span className="flex flex-col">
                    <span className="text-sm font-medium" style={{ color: "var(--pc-ink-950)" }}>
                      {opt.label}
                    </span>
                    <span className="text-xs" style={{ color: "var(--pc-ink-500)" }}>
                      {opt.hint}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {detectedColors.length > 0 && (
            <div className="pt-3" style={{ borderTop: "1px solid var(--pc-ink-100)" }}>
              <p className="text-xs mb-1.5" style={{ color: "var(--pc-ink-500)" }}>
                Colors detected in this logo
              </p>
              <div className="flex flex-wrap gap-2">
                {detectedColors.map((c) => {
                  const pantone = nearestPantone(c.hex);
                  // Selecting a suggested Pantone sets it as the order's
                  // ink color — the same field the Technique panel's ink
                  // picker uses, which already flows through to
                  // inkPantoneCode/inkColorHex on the cart item, so this
                  // becomes part of the order like size/quantity/technique
                  // without a separate field to plumb through.
                  const isSelected = !!pantone && !!selectedInkColor && selectedInkColor.toLowerCase() === c.hex.toLowerCase();
                  return (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => pantone && onSelectInkColor?.(c.hex)}
                      disabled={!pantone || !onSelectInkColor}
                      aria-pressed={isSelected}
                      className="inline-flex flex-col gap-0.5 text-[11px] rounded-xl px-2 py-1.5 text-left disabled:cursor-default"
                      style={{ border: `1px solid ${isSelected ? "var(--color-terracotta)" : "var(--pc-ink-100)"}`, background: isSelected ? "var(--pc-ink-50)" : "transparent" }}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: c.hex, border: "1px solid var(--pc-ink-200)" }} />
                        {c.hex.toUpperCase()} · {c.pct}%
                        {isSelected && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-terracotta)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M20 6 9 17l-5-5" />
                          </svg>
                        )}
                      </span>
                      {pantone && (
                        <span style={{ color: "var(--pc-ink-500)" }}>
                          ≈ {pantone.code} <span className="text-[10px]">{isSelected ? "· used for this order" : "(approximate — tap to use)"}</span>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="pt-3" style={{ borderTop: "1px solid var(--pc-ink-100)" }}>
            <p className="text-xs" style={{ color: "var(--pc-ink-400)" }}>
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
