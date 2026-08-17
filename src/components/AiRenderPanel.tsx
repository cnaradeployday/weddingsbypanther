"use client";

import { useState } from "react";
import Image from "next/image";

const MAX_RENDERS_PER_PRODUCT = 3;

function sessionKey(productId: string) {
  return `bespoke-ai-renders:${productId}`;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function AiRenderPanel({
  productId,
  names,
  date,
  monogram,
}: {
  productId: string;
  names: string;
  date: string;
  monogram: string;
}) {
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [usedCount, setUsedCount] = useState(() => {
    if (typeof window === "undefined") return 0;
    return Number(sessionStorage.getItem(sessionKey(productId)) ?? "0");
  });

  const remaining = MAX_RENDERS_PER_PRODUCT - usedCount;

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(await fileToDataUrl(file));
  };

  const handleGenerate = async () => {
    if (remaining <= 0) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const logoDataUrl = logoFile ? await fileToDataUrl(logoFile) : undefined;
      const res = await fetch("/api/ai-render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, names, date, monogram, logoDataUrl }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not generate a preview.");
      setResult(json.imageDataUrl);
      const next = usedCount + 1;
      setUsedCount(next);
      sessionStorage.setItem(sessionKey(productId), String(next));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate a preview.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-8 rounded-xl border border-dashed border-gold bg-gold/5 p-5">
      <div className="flex items-center gap-2 mb-2">
        <p className="text-sm font-medium">AI render preview</p>
        <span className="text-[10px] uppercase tracking-wide bg-gold/30 text-dark px-2 py-0.5 rounded-full">
          Beta
        </span>
      </div>
      <p className="text-xs text-muted mb-4">
        Optional — upload your own logo, or leave it blank to use the names/monogram above. We&apos;ll
        generate a realistic preview on this exact product photo. {remaining} of {MAX_RENDERS_PER_PRODUCT}{" "}
        left this session.
      </p>

      <div className="flex items-center gap-3 mb-4">
        <label className="relative h-14 w-14 rounded-lg overflow-hidden border border-line cursor-pointer bg-white shrink-0">
          {logoPreview ? (
            <Image src={logoPreview} alt="" fill className="object-contain" unoptimized />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-[10px] text-muted text-center px-1">
              Upload logo
            </span>
          )}
          <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
        </label>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading || remaining <= 0}
          className="px-5 py-3 rounded-full bg-dark text-cream-light text-sm font-medium hover:bg-dark-soft transition-colors disabled:opacity-50"
        >
          {loading ? "Generating…" : remaining <= 0 ? "Limit reached" : "Generate AI preview"}
        </button>
      </div>

      {error && <p className="text-sm text-terracotta-dark mb-3">{error}</p>}

      {result && (
        <div className="max-w-xs">
          <div className="relative aspect-[4/5] rounded-xl overflow-hidden border border-line bg-cream">
            <Image src={result} alt="AI-generated preview" fill className="object-contain" unoptimized />
            <span className="absolute bottom-2 left-2 text-[10px] bg-cream-light/90 px-2 py-1 rounded-full">
              AI-generated — not a guaranteed final result
            </span>
          </div>
          <a
            href={result}
            download={`bespoke-ai-preview.${result.match(/^data:image\/(\w+);/)?.[1] ?? "png"}`}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium underline underline-offset-2 hover:text-terracotta-dark transition-colors"
          >
            Download image
          </a>
        </div>
      )}
    </div>
  );
}
