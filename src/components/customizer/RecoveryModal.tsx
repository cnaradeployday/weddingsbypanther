"use client";

import { useState } from "react";
import { DesignThumbnail } from "./DesignThumbnail";
import type { SavedDesignSummary } from "@/lib/designStorage";

// FLOW-02: "Pick up where you left off?" — shown when saved designs already
// exist for this product. Relative-time formatting matches the doc's own
// example phrasing ("Edited 20 minutes ago").
function relativeTime(ms: number): string {
  const diffSec = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (diffSec < 60) return "Edited just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `Edited ${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `Edited ${diffHr} hour${diffHr === 1 ? "" : "s"} ago`;
  const diffDay = Math.round(diffHr / 24);
  return `Edited ${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
}

export function RecoveryModal({
  versions,
  zones,
  images,
  techniques,
  onContinue,
  onStartNew,
  onClose,
  // Reused as-is for the on-demand "My Drafts" button (see
  // ProductConfigurator.tsx) — only the copy differs from FLOW-02's
  // auto-shown "pick up where you left off" case.
  title = "Pick up where you left off?",
  continueLabel = "Continue design",
  startNewLabel = "Start a new one",
}: {
  versions: SavedDesignSummary[];
  zones: { id: string; corners_pct: { x: number; y: number }[]; image_id: string | null }[];
  images: { id: string; url: string }[];
  techniques: { id: string; technique: string }[];
  onContinue: (versionId: string) => void;
  onStartNew: () => void;
  onClose: () => void;
  title?: string;
  continueLabel?: string;
  startNewLabel?: string;
}) {
  // The most recent version (versions[0] — designStorage.list returns
  // newest first) is preselected, per FLOW-02.
  const [selected, setSelected] = useState(versions[0]?.versionId ?? "");

  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl overflow-hidden max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <h2 className="font-serif text-2xl">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="h-11 w-11 -mr-2 flex items-center justify-center text-lg text-muted shrink-0"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
          {versions.length === 0 && <p className="text-sm text-muted p-3">No saved drafts yet.</p>}
          {versions.map((v) => {
            const zone = zones.find((z) => z.id === v.activeZoneId) ?? zones[0];
            const photoUrl =
              (zone?.image_id ? images.find((i) => i.id === zone.image_id)?.url : undefined) ??
              images[0]?.url ??
              null;
            const technique = techniques.find((t) => t.id === v.techniqueId);
            const isSelected = selected === v.versionId;
            return (
              <label
                key={v.versionId}
                className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer ${
                  isSelected ? "border-dark bg-cream" : "border-line"
                }`}
              >
                <input
                  type="radio"
                  name="recovery-version"
                  checked={isSelected}
                  onChange={() => setSelected(v.versionId)}
                  className="sr-only"
                />
                <DesignThumbnail
                  photoUrl={photoUrl}
                  zone={zone}
                  names={v.names}
                  textFont={v.textFont}
                  namesColor={v.namesColor}
                  namesPosition={v.namesPosition}
                  logoUrl={v.logoThumbnail}
                  logoPosition={v.logoPosition}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{v.draftName || v.names || "Untitled design"}</p>
                  <p className="text-xs text-muted">{relativeTime(v.updatedAt)}</p>
                  <p className="text-xs text-muted">
                    {technique?.technique ?? "—"} · {v.quantity} units
                  </p>
                </div>
              </label>
            );
          })}
        </div>
        <div className="flex items-center gap-3 px-6 py-4 border-t border-line">
          <button
            type="button"
            onClick={onStartNew}
            className="flex-1 h-11 rounded-full border border-line text-sm font-medium"
          >
            {startNewLabel}
          </button>
          <button
            type="button"
            onClick={() => onContinue(selected)}
            disabled={!selected}
            className="flex-1 h-11 rounded-full bg-terracotta text-cream-light text-sm font-medium disabled:opacity-50"
          >
            {continueLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
