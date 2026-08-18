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

function downloadName(dataUrl: string, label: string) {
  return `bespoke-ai-${label}.${dataUrl.match(/^data:image\/(\w+);/)?.[1] ?? "png"}`;
}

function RenderCard({ label, src }: { label: string; src: string }) {
  return (
    <div>
      <div className="relative aspect-[4/5] rounded-xl overflow-hidden border border-line bg-cream">
        <Image src={src} alt={label} fill className="object-contain" unoptimized />
        <span className="absolute bottom-2 left-2 text-[10px] bg-cream-light/90 px-2 py-1 rounded-full">
          AI-generated — not a guaranteed final result
        </span>
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-muted">{label}</span>
        <a
          href={src}
          download={downloadName(src, label.toLowerCase().replace(/\s+/g, "-"))}
          className="text-xs font-medium underline underline-offset-2 hover:text-terracotta-dark transition-colors"
        >
          Download
        </a>
      </div>
    </div>
  );
}

export function AiRenderPanel({
  productId,
  names,
  date,
  monogram,
  frame = "",
  textFont = "",
  logoFile = null,
  positions,
  elemScale = {},
  elemRotationOffset = {},
  images = [],
  defaultImageId = null,
  unlimited = false,
  onGenerated,
}: {
  productId: string;
  names: string;
  date: string;
  monogram: string;
  frame?: string;
  textFont?: string;
  logoFile?: File | null;
  positions?: Record<string, { x: number; y: number }>;
  elemScale?: Record<string, number>;
  elemRotationOffset?: Record<string, number>;
  images?: { id: string; url: string }[];
  defaultImageId?: string | null;
  unlimited?: boolean;
  onGenerated?: (result: { imageDataUrl: string; contextImageDataUrl: string | null }) => void;
}) {
  const [imageId, setImageId] = useState<string | null>(defaultImageId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [contextResult, setContextResult] = useState<string | null>(null);
  const [usedCount, setUsedCount] = useState(() => {
    if (typeof window === "undefined") return 0;
    return Number(sessionStorage.getItem(sessionKey(productId)) ?? "0");
  });

  const remaining = unlimited ? Infinity : MAX_RENDERS_PER_PRODUCT - usedCount;

  const handleGenerate = async () => {
    if (remaining <= 0) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setContextResult(null);

    try {
      const logoDataUrl = logoFile ? await fileToDataUrl(logoFile) : undefined;
      const res = await fetch("/api/ai-render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          names,
          date,
          monogram,
          frame,
          textFont,
          logoDataUrl,
          positions,
          elemScale,
          elemRotationOffsetDeg: elemRotationOffset,
          imageId,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not generate a preview.");
      setResult(json.imageDataUrl);
      setContextResult(json.contextImageDataUrl ?? null);
      onGenerated?.({ imageDataUrl: json.imageDataUrl, contextImageDataUrl: json.contextImageDataUrl ?? null });
      if (!unlimited) {
        const next = usedCount + 1;
        setUsedCount(next);
        sessionStorage.setItem(sessionKey(productId), String(next));
      }
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
        Uses the logo (or names/monogram) from above and generates a close-up product preview plus a
        wedding lifestyle shot.{" "}
        {unlimited ? "Unlimited renders for your account." : `${remaining} of ${MAX_RENDERS_PER_PRODUCT} left this session.`}
      </p>

      {images.length > 1 && (
        <div className="mb-4">
          <p className="text-xs uppercase tracking-wide text-muted mb-2">Render on this photo</p>
          <div className="flex gap-2 flex-wrap">
            {images.map((img) => (
              <button
                key={img.id}
                type="button"
                onClick={() => setImageId(img.id)}
                className={`relative h-12 w-12 rounded-lg overflow-hidden border-2 ${
                  imageId === img.id ? "border-terracotta" : "border-transparent"
                }`}
              >
                <Image src={img.url} alt="" fill className="object-cover" unoptimized />
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={handleGenerate}
        disabled={loading || remaining <= 0}
        className="px-5 py-3 rounded-full bg-dark text-cream-light text-sm font-medium hover:bg-dark-soft transition-colors disabled:opacity-50 mb-4"
      >
        {loading ? "Generating…" : remaining <= 0 ? "Limit reached" : "Generate AI preview"}
      </button>

      {error && <p className="text-sm text-terracotta-dark mb-3">{error}</p>}

      {result && (
        <div className="grid grid-cols-2 gap-4 max-w-xl">
          <RenderCard label="Product" src={result} />
          {contextResult ? (
            <RenderCard label="Wedding context" src={contextResult} />
          ) : (
            <div className="relative aspect-[4/5] rounded-xl border border-dashed border-line flex items-center justify-center">
              <p className="text-xs text-muted text-center px-3">
                Couldn&apos;t generate the wedding-context shot this time.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
