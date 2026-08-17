"use client";

import { useCallback, useEffect, useRef } from "react";
import Image from "next/image";

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

type Zone = { posX: number; posY: number; width: number; height: number };
type DragState = { mode: "move" | "resize"; startX: number; startY: number; orig: Zone };

export function PrintAreaTool({
  imageUrl,
  zone,
  onChange,
  sizeLabel,
}: {
  imageUrl: string | null;
  zone: Zone;
  onChange: (zone: Zone) => void;
  sizeLabel?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<DragState | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Listeners stay attached for the component's lifetime; they no-op unless
  // a drag is in progress (dragState.current is set on pointer down).
  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      const state = dragState.current;
      const container = containerRef.current;
      if (!state || !container) return;
      const rect = container.getBoundingClientRect();
      const dxPct = ((e.clientX - state.startX) / rect.width) * 100;
      const dyPct = ((e.clientY - state.startY) / rect.height) * 100;

      if (state.mode === "move") {
        onChangeRef.current({
          posX: clamp(state.orig.posX + dxPct, 0, 100 - state.orig.width),
          posY: clamp(state.orig.posY + dyPct, 0, 100 - state.orig.height),
          width: state.orig.width,
          height: state.orig.height,
        });
      } else {
        onChangeRef.current({
          posX: state.orig.posX,
          posY: state.orig.posY,
          width: clamp(state.orig.width + dxPct, 10, 100 - state.orig.posX),
          height: clamp(state.orig.height + dyPct, 10, 100 - state.orig.posY),
        });
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

  const handlePointerDown = useCallback(
    (mode: "move" | "resize") => (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragState.current = { mode, startX: e.clientX, startY: e.clientY, orig: zone };
    },
    [zone]
  );

  return (
    <div
      ref={containerRef}
      className="relative aspect-square rounded-lg overflow-hidden bg-cream border border-line select-none"
    >
      {imageUrl ? (
        <Image src={imageUrl} alt="" fill className="object-cover pointer-events-none" unoptimized />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-muted px-6 text-center">
          Upload a photo above to position the print zone on it
        </div>
      )}
      <div
        onPointerDown={handlePointerDown("move")}
        className="absolute border-2 border-dashed border-terracotta bg-terracotta/20 cursor-move touch-none flex items-center justify-center"
        style={{
          left: `${zone.posX}%`,
          top: `${zone.posY}%`,
          width: `${zone.width}%`,
          height: `${zone.height}%`,
        }}
      >
        {sizeLabel && (
          <span className="pointer-events-none text-[11px] font-medium text-terracotta-dark bg-cream-light/90 px-2 py-0.5 rounded-full whitespace-nowrap">
            {sizeLabel}
          </span>
        )}
        <div
          onPointerDown={handlePointerDown("resize")}
          className="absolute -right-1.5 -bottom-1.5 h-4 w-4 rounded-full bg-terracotta border-2 border-cream-light cursor-nwse-resize touch-none"
        />
      </div>
    </div>
  );
}
