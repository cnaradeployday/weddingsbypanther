"use client";

import { useState } from "react";
import Image from "next/image";
import type { PreviewPhoto, PreviewAiRender } from "./PreviewModal";
import { toPreviewEntries, useCompositedPreview } from "./useCompositedPreview";

// The Confirmación step (merged Options + Review) shows only this
// read-only server-composited preview — never the live editable canvas —
// per request: "dejar solo el preview, nada mas. No poder editar nada del
// logo en esa pantalla." Reuses the same compositor and entry list as the
// "Preview" button's modal (PreviewModal), just laid out inline instead of
// as a full-screen overlay.
export function ConfirmationPreview({
  photos,
  aiRenders,
}: {
  photos: PreviewPhoto[];
  aiRenders: PreviewAiRender[];
}) {
  const entries = toPreviewEntries(photos, aiRenders);
  const [activeKey, setActiveKey] = useState(entries[0]?.key ?? "");
  const { active, composited, loading } = useCompositedPreview(entries, activeKey);

  if (!active) return null;
  const isAi = active.key.startsWith("ai-");
  const src = isAi ? active.fallbackUrl : composited[active.key] ?? active.fallbackUrl;

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      <div
        className="relative flex-1 min-h-0 overflow-hidden bg-white"
        style={{ borderRadius: 20, border: "1px solid var(--pc-border-subtle)", boxShadow: "var(--pc-shadow-sm)" }}
      >
        <Image src={src} alt={active.label} fill className="object-contain" unoptimized />
        {loading[active.key] && (
          <span className="absolute inset-0 flex items-center justify-center text-sm" style={{ color: "var(--pc-ink-500)" }}>
            Rendering preview…
          </span>
        )}
        {isAi && (
          <span className="absolute bottom-3 left-3 text-[11px] bg-white/90 px-3 py-1 rounded-full" style={{ color: "var(--pc-ink-700)" }}>
            AI-generated — not a guaranteed final result
          </span>
        )}
        <span
          className="absolute top-3 left-3 text-[11px] px-3 py-1 rounded-full"
          style={{ background: "rgba(255,255,255,0.9)", color: "var(--pc-ink-700)" }}
        >
          Preview only — go back to Design to make changes
        </span>
      </div>
      {entries.length > 1 && (
        <div className="flex-none flex items-center gap-2 overflow-x-auto">
          {entries.map((e) => (
            <button
              key={e.key}
              type="button"
              onClick={() => setActiveKey(e.key)}
              aria-current={e.key === activeKey}
              aria-label={e.label}
              className="relative h-16 w-16 shrink-0 rounded-lg overflow-hidden"
              style={{ border: `2px solid ${e.key === activeKey ? "var(--color-terracotta)" : "transparent"}` }}
            >
              <Image src={composited[e.key] ?? e.fallbackUrl} alt="" fill className="object-cover" unoptimized />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
