"use client";

import { useCallback, useEffect, useRef } from "react";
import Image from "next/image";

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

type Zone = { posX: number; posY: number; width: number; height: number; rotation: number };
type DragState = { mode: "move" | "resize" | "rotate"; startX: number; startY: number; orig: Zone };

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

      if (state.mode === "rotate") {
        const centerX = rect.left + ((state.orig.posX + state.orig.width / 2) / 100) * rect.width;
        const centerY = rect.top + ((state.orig.posY + state.orig.height / 2) / 100) * rect.height;
        const angleRad = Math.atan2(e.clientY - centerY, e.clientX - centerX);
        let deg = Math.round((angleRad * 180) / Math.PI + 90);
        if (deg > 180) deg -= 360;
        if (deg < -180) deg += 360;
        onChangeRef.current({ ...state.orig, rotation: deg });
        return;
      }

      const dxPct = ((e.clientX - state.startX) / rect.width) * 100;
      const dyPct = ((e.clientY - state.startY) / rect.height) * 100;

      if (state.mode === "move") {
        onChangeRef.current({
          ...state.orig,
          posX: clamp(state.orig.posX + dxPct, 0, 100 - state.orig.width),
          posY: clamp(state.orig.posY + dyPct, 0, 100 - state.orig.height),
        });
      } else {
        onChangeRef.current({
          ...state.orig,
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
    (mode: "move" | "resize" | "rotate") => (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragState.current = { mode, startX: e.clientX, startY: e.clientY, orig: zone };
    },
    [zone]
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
      <div
        onPointerDown={handlePointerDown("move")}
        className="absolute border-2 border-dashed border-terracotta bg-terracotta/20 cursor-move touch-none flex items-center justify-center"
        style={{
          left: `${zone.posX}%`,
          top: `${zone.posY}%`,
          width: `${zone.width}%`,
          height: `${zone.height}%`,
          transform: `rotate(${zone.rotation ?? 0}deg)`,
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
        <div
          onPointerDown={handlePointerDown("rotate")}
          className="absolute left-1/2 -top-7 -translate-x-1/2 h-4 w-4 rounded-full bg-cream-light border-2 border-terracotta cursor-alias touch-none"
        />
        <div className="pointer-events-none absolute left-1/2 -top-5 -translate-x-1/2 w-px h-5 bg-terracotta/60" />
      </div>
    </div>
  );
}
