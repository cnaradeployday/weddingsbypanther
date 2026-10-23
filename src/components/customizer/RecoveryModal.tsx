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
  variants = [],
  techniques,
  onContinue,
  onStartNew,
  onClose,
  // Permanent — "hoy se acumulan [los drafts]" — only wired up for the
  // on-demand "My Drafts" list (see ProductConfigurator.tsx), not FLOW-02's
  // auto-shown recovery modal, where deleting the one draft being recovered
  // would be an odd/risky action to offer.
  onDelete,
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
  // A variant with its own photo (chosen on ProductLanding, before the
  // builder) overrides the product's generic photo entirely for designs
  // saved under it — same as the live canvas's own displayImage. Without
  // this, every draft's thumbnail fell back to the product's generic
  // photo regardless of which color it was actually designed on ("la
  // miniatura no respeta el color real del cuaderno").
  variants?: { id: string; image_url: string | null }[];
  techniques: { id: string; technique: string }[];
  onContinue: (versionId: string) => void;
  onStartNew: () => void;
  onClose: () => void;
  onDelete?: (versionId: string) => void;
  title?: string;
  continueLabel?: string;
  startNewLabel?: string;
}) {
  // The most recent version (versions[0] — designStorage.list returns
  // newest first) is preselected, per FLOW-02.
  const [selected, setSelected] = useState(versions[0]?.versionId ?? "");

  return (
    // z-[200], not z-50 — matches every other full-screen overlay in this
    // editor (LogoCropModal, SaveDraftModal, FontPicker, PreviewModal): the
    // live canvas's selected element sets zIndex:100 on its own wrapper
    // while active, which would otherwise paint its resize/rotate handles
    // on top of a z-50 modal if "My Drafts" is opened with an element still
    // selected.
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4">
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
              variants.find((variant) => variant.id === v.variantId)?.image_url ??
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
                {onDelete && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (window.confirm(`Delete "${v.draftName || v.names || "Untitled design"}"? This can't be undone.`)) {
                        onDelete(v.versionId);
                      }
                    }}
                    aria-label="Delete draft"
                    title="Delete draft"
                    className="shrink-0 h-9 w-9 rounded-full flex items-center justify-center text-muted hover:text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3 6h18" />
                      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6M14 11v6" />
                    </svg>
                  </button>
                )}
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
