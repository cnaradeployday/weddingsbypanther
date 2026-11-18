"use client";

import dynamic from "next/dynamic";
import type { ZoneTextureInput } from "./Product3DViewer";

const Product3DViewer = dynamic(() => import("./Product3DViewer").then((m) => m.Product3DViewer), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-sm text-muted">Loading 3D view…</div>
  ),
});

export function Share3DView({
  glbUrl,
  activeMeshName,
  otherMeshNames,
  zoneTextures,
}: {
  glbUrl: string;
  activeMeshName: string | null;
  otherMeshNames: string[];
  zoneTextures: ZoneTextureInput[];
}) {
  return (
    <div className="fixed inset-0 bg-white">
      {/* "deberia tener la indicacion de que podes girarlo con el mouse"
          — unlike the admin's own 3D modal (which has a header bar with a
          "Drag to rotate" label), this public share link opens straight
          into the fullscreen viewer with no chrome at all, so a first-time
          visitor has no cue that the model responds to drag. */}
      <div className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 rounded-full border border-line bg-white/90 backdrop-blur-sm px-4 py-2 shadow-sm text-xs text-muted">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="9" y="7" width="6" height="11" rx="2" />
          <path d="M8 10 5 13l3 3" />
          <path d="M16 10l3 3-3 3" />
        </svg>
        Drag to rotate
      </div>
      <Product3DViewer
        glbUrl={glbUrl}
        activeMeshName={activeMeshName}
        otherMeshNames={otherMeshNames}
        zoneTextures={zoneTextures}
      />
    </div>
  );
}
