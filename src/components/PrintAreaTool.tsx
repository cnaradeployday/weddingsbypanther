"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import Image from "next/image";

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

export type Corner = { x: number; y: number };
// Order: top-left, top-right, bottom-right, bottom-left.
export type Quad = [Corner, Corner, Corner, Corner];

type DragState = { mode: "move" | "corner"; cornerIndex?: number; startX: number; startY: number; orig: Quad };

export function PrintAreaTool({
  imageUrl,
  corners,
  onChange,
  sizeLabel,
}: {
  imageUrl: string | null;
  corners: Quad;
  onChange: (corners: Quad) => void;
  sizeLabel?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<DragState | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      const state = dragState.current;
      const container = containerRef.current;
      if (!state || !container) return;
      const rect = container.getBoundingClientRect();
      const dxPct = ((e.clientX - state.startX) / rect.width) * 100;
      const dyPct = ((e.clientY - state.startY) / rect.height) * 100;

      if (state.mode === "corner" && state.cornerIndex !== undefined) {
        const next = state.orig.map((c) => ({ ...c })) as Quad;
        next[state.cornerIndex] = {
          x: clamp(state.orig[state.cornerIndex].x + dxPct, 0, 100),
          y: clamp(state.orig[state.cornerIndex].y + dyPct, 0, 100),
        };
        onChangeRef.current(next);
      } else {
        const next = state.orig.map((c) => ({
          x: clamp(c.x + dxPct, 0, 100),
          y: clamp(c.y + dyPct, 0, 100),
        })) as Quad;
        onChangeRef.current(next);
      }
    };

    const handleUp = () => {
      dragState.current = null;
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, []);

  const startMove = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragState.current = { mode: "move", startX: e.clientX, startY: e.clientY, orig: corners };
    },
    [corners]
  );

  const startCornerDrag = useCallback(
    (index: number) => (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragState.current = { mode: "corner", cornerIndex: index, startX: e.clientX, startY: e.clientY, orig: corners };
    },
    [corners]
  );

  const points = useMemo(() => corners.map((c) => `${c.x},${c.y}`).join(" "), [corners]);
  const centroid = useMemo(
    () => ({
      x: corners.reduce((s, c) => s + c.x, 0) / 4,
      y: corners.reduce((s, c) => s + c.y, 0) / 4,
    }),
    [corners]
  );

  return (
    <div
      ref={containerRef}
      className="relative aspect-[4/5] rounded-lg overflow-hidden bg-cream border border-line select-none"
    >
      {imageUrl ? (
        <Image src={imageUrl} alt="" fill className="object-cover pointer-events-none" unoptimized />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-muted px-6 text-center">
          Upload a photo above to position the print zone on it
        </div>
      )}

      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full pointer-events-none"
      >
        <polygon
          points={points}
          fill="rgba(198,93,60,0.18)"
          stroke="rgb(198,93,60)"
          strokeWidth={0.6}
          strokeDasharray="2.4,1.5"
          vectorEffect="non-scaling-stroke"
          className="pointer-events-auto cursor-move touch-none"
          onPointerDown={startMove}
        />
      </svg>

      {sizeLabel && (
        <span
          className="absolute pointer-events-none text-[11px] font-medium text-terracotta-dark bg-cream-light/90 px-2 py-0.5 rounded-full whitespace-nowrap"
          style={{ left: `${centroid.x}%`, top: `${centroid.y}%`, transform: "translate(-50%, -50%)" }}
        >
          {sizeLabel}
        </span>
      )}

      {corners.map((c, i) => (
        <div
          key={i}
          onPointerDown={startCornerDrag(i)}
          className="absolute h-4 w-4 rounded-full bg-terracotta border-2 border-cream-light cursor-pointer touch-none"
          style={{ left: `${c.x}%`, top: `${c.y}%`, transform: "translate(-50%, -50%)" }}
        />
      ))}
    </div>
  );
}
