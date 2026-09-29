"use client";

import { useEffect, useState } from "react";
import type { PreviewPhoto, PreviewAiRender } from "./PreviewModal";

// Shared by PreviewModal and the Confirmación step's inline read-only
// preview — both show the same server-composited "what does this look
// like on the real photo" snapshot (see PreviewModal's own comment for
// why that compositor, not a client render, is the source of truth).
export type PreviewEntry = { key: string; label: string; fallbackUrl: string; request: PreviewPhoto["snapshotRequest"] };

export function toPreviewEntries(photos: PreviewPhoto[], aiRenders: PreviewAiRender[]): PreviewEntry[] {
  return [
    ...photos.map((p, i) => ({ key: `photo-${p.id}`, label: i === 0 ? "Front" : `View ${i + 1}`, fallbackUrl: p.url, request: p.snapshotRequest })),
    ...aiRenders.map((r) => ({ key: `ai-${r.url}`, label: r.label, fallbackUrl: r.url, request: null })),
  ];
}

export function useCompositedPreview(entries: PreviewEntry[], activeKey: string) {
  const [composited, setComposited] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const active = entries.find((e) => e.key === activeKey) ?? entries[0];

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
        technique: req.technique,
        names: req.names,
        date: req.date,
        monogram: req.monogram,
        frame: req.frame,
        textFont: req.textFont,
        logoDataUrl: req.logoDataUrl,
        positions: req.positions,
        elemScale: req.elemScale,
        elemRotationOffsetDeg: req.elemRotationOffsetDeg,
        inkColor: req.inkColor,
        namesColor: req.namesColor,
        dateColor: req.dateColor,
        monogramColor: req.monogramColor,
        frameColor: req.frameColor,
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

  return { active, composited, loading };
}
