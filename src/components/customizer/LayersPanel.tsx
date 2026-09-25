"use client";

import { useRef, useState } from "react";
import type { Design, ElemKey } from "./types";
import { ELEM_LABELS, isElemPresent } from "./types";

// EDIT-14: lists every present element in stacking order (front = top of
// the list, matching elemOrder's back-to-front array), drag to reorder,
// lock (a locked element can't be selected/dragged on the canvas) and hide
// (a hidden element isn't printed — flagged in 03-purchase-flow.md's
// Review step, out of this document's scope).
export function LayersPanel({
  design,
  activeElem,
  onSelect,
  onReorder,
  onToggleLock,
  onToggleHide,
}: {
  design: Design;
  activeElem: ElemKey | null;
  onSelect: (key: ElemKey) => void;
  onReorder: (order: ElemKey[]) => void;
  onToggleLock: (key: ElemKey) => void;
  onToggleHide: (key: ElemKey) => void;
}) {
  const presentKeys = [...design.elemOrder].reverse().filter((k) => isElemPresent(design, k));
  const dragIndex = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const commitReorder = (from: number, to: number) => {
    if (from === to) return;
    // presentKeys is front-to-back for display; elemOrder is back-to-front.
    const next = [...presentKeys];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    const reversed = [...next].reverse();
    // Elements not currently present (never configured) keep their
    // existing relative order, appended behind the present ones.
    const untouched = design.elemOrder.filter((k) => !presentKeys.includes(k));
    onReorder([...untouched, ...reversed]);
  };

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-serif text-2xl">Layers</h2>
      {presentKeys.length === 0 ? (
        <p className="text-sm text-muted">Nothing on the design yet.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {presentKeys.map((key, i) => {
            const locked = !!design.locked[key];
            const hidden = !!design.hidden[key];
            return (
              <li
                key={key}
                draggable
                onDragStart={() => {
                  dragIndex.current = i;
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverIndex(i);
                }}
                onDragEnd={() => {
                  if (dragIndex.current !== null && dragOverIndex !== null) {
                    commitReorder(dragIndex.current, dragOverIndex);
                  }
                  dragIndex.current = null;
                  setDragOverIndex(null);
                }}
                className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 ${
                  activeElem === key ? "border-dark bg-cream" : "border-line"
                } ${dragOverIndex === i ? "border-terracotta" : ""}`}
              >
                <span aria-hidden="true" className="cursor-grab text-muted px-0.5">
                  ⠿
                </span>
                <button
                  type="button"
                  onClick={() => onSelect(key)}
                  className="flex-1 text-left text-sm truncate"
                >
                  {ELEM_LABELS[key]}
                </button>
                <button
                  type="button"
                  onClick={() => onToggleLock(key)}
                  aria-label={locked ? `Unlock ${ELEM_LABELS[key]}` : `Lock ${ELEM_LABELS[key]}`}
                  aria-pressed={locked}
                  className={`h-8 w-8 flex items-center justify-center rounded-lg ${locked ? "text-terracotta-dark" : "text-muted"}`}
                >
                  {locked ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="5" y="11" width="14" height="9" rx="2" />
                      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="5" y="11" width="14" height="9" rx="2" />
                      <path d="M8 11V7a4 4 0 0 1 7.4-2" />
                    </svg>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onToggleHide(key)}
                  aria-label={hidden ? `Show ${ELEM_LABELS[key]}` : `Hide ${ELEM_LABELS[key]}`}
                  aria-pressed={hidden}
                  className={`h-8 w-8 flex items-center justify-center rounded-lg ${hidden ? "text-terracotta-dark" : "text-muted"}`}
                >
                  {hidden ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3 3l18 18" />
                      <path d="M10.6 5.1A10.6 10.6 0 0 1 12 5c6 0 9.5 6.5 9.5 6.5a13.2 13.2 0 0 1-2.7 3.5M6.6 6.6C3.6 8.4 2.5 11.5 2.5 11.5S6 18 12 18a9.7 9.7 0 0 0 3.1-.5" />
                      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {presentKeys.some((k) => design.hidden[k]) && (
        <p className="text-xs text-terracotta-dark">
          Hidden layers won&apos;t be printed.
        </p>
      )}
    </div>
  );
}
