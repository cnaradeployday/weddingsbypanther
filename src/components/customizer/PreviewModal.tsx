"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

// FLOW-04's preview modal. Reuses the same server-side deterministic
// compositor already built for the cart snapshot (`/api/personalization-
// snapshot`, backed by personalizationComposite.ts) rather than a second,
// duplicate client-side rendering path — it's the pixel-accurate, already-
// tested source of truth for "what does this look like on the real photo."
// Shares that route's known gap (documented in the PR): it still reflects
// the old 4-element model, so an independently-positioned frame, the QR
// code, and per-element colors aren't part of the composited image yet.
export type PreviewPhoto = {
  id: string;
  url: string;
  // A photo this print area doesn't map to (no zone points at it) has no
  // design to composite — shown as-is, per FLOW-04: "must not suggest they
  // include the design."
  snapshotRequest: {
    productId: string;
    zoneId: string;
    imageId: string;
    names: string;
    date: string;
    monogram: string;
    frame: string;
    textFont: string;
    logoDataUrl?: string;
    positions: Record<string, { x: number; y: number }>;
    elemScale: Record<string, number>;
    elemRotationOffsetDeg: Record<string, number>;
  } | null;
};

export type PreviewAiRender = { label: string; url: string };

export function PreviewModal({
  photos,
  aiRenders,
  onClose,
}: {
  photos: PreviewPhoto[];
  aiRenders: PreviewAiRender[];
  onClose: () => void;
}) {
  type Entry = { key: string; label: string; fallbackUrl: string; request: PreviewPhoto["snapshotRequest"] };
  const entries: Entry[] = [
    ...photos.map((p, i) => ({ key: `photo-${p.id}`, label: i === 0 ? "Front" : `View ${i + 1}`, fallbackUrl: p.url, request: p.snapshotRequest })),
    ...aiRenders.map((r) => ({ key: `ai-${r.url}`, label: r.label, fallbackUrl: r.url, request: null })),
  ];
  const [activeKey, setActiveKey] = useState(entries[0]?.key ?? "");
  const [composited, setComposited] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const active = entries.find((e) => e.key === activeKey) ?? entries[0];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!active?.request || composited[active.key] || loading[active.key]) return;
    const req = active.request;
    // Marks this entry in-flight before the fetch starts — reflects an
    // external async operation's own status, not something derivable from
    // render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading((prev) => ({ ...prev, [active.key]: true }));
    fetch("/api/personalization-snapshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: req.productId,
        zoneId: req.zoneId,
        imageId: req.imageId,
        names: req.names,
        date: req.date,
        monogram: req.monogram,
        frame: req.frame,
        textFont: req.textFont,
        logoDataUrl: req.logoDataUrl,
        positions: req.positions,
        elemScale: req.elemScale,
        elemRotationOffsetDeg: req.elemRotationOffsetDeg,
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.imageDataUrl) setComposited((prev) => ({ ...prev, [active.key]: json.imageDataUrl }));
      })
      .catch(() => {
        // Fails soft — the plain reference photo (fallbackUrl) still shows.
      })
      .finally(() => setLoading((prev) => ({ ...prev, [active.key]: false })));
    // Re-runs only when the selected entry changes — each entry is fetched
    // and cached at most once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.key]);

  if (!active) return null;
  const isAi = active.key.startsWith("ai-");
  const src = isAi ? active.fallbackUrl : composited[active.key] ?? active.fallbackUrl;

  return (
    <div role="dialog" aria-modal="true" aria-label="Preview" className="fixed inset-0 z-50 flex flex-col bg-black/70">
      <div className="flex items-center justify-between px-4 md:px-6 h-16 shrink-0">
        <span className="text-cream-light font-serif text-lg">Preview</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close preview"
          className="h-11 w-11 flex items-center justify-center rounded-full text-cream-light hover:bg-white/10 text-xl"
        >
          ×
        </button>
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center px-4">
        <div className="relative w-full max-w-2xl aspect-[4/5]">
          <Image src={src} alt={active.label} fill className="object-contain" unoptimized />
          {loading[active.key] && (
            <span className="absolute inset-0 flex items-center justify-center text-cream-light text-sm">
              Rendering preview…
            </span>
          )}
          {isAi && (
            <span className="absolute bottom-3 left-3 text-[11px] bg-cream-light/90 px-3 py-1 rounded-full">
              AI-generated — not a guaranteed final result
            </span>
          )}
        </div>
      </div>
      <div className="shrink-0 flex items-center gap-2 overflow-x-auto px-4 py-4">
        {entries.map((e) => (
          <button
            key={e.key}
            type="button"
            onClick={() => setActiveKey(e.key)}
            aria-current={e.key === activeKey}
            aria-label={e.label}
            className={`relative h-16 w-16 shrink-0 rounded-lg overflow-hidden border-2 ${
              e.key === activeKey ? "border-terracotta" : "border-transparent"
            }`}
          >
            <Image src={composited[e.key] ?? e.fallbackUrl} alt="" fill className="object-cover" unoptimized />
          </button>
        ))}
      </div>
    </div>
  );
}
