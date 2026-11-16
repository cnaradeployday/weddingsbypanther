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
      <Product3DViewer
        glbUrl={glbUrl}
        activeMeshName={activeMeshName}
        otherMeshNames={otherMeshNames}
        zoneTextures={zoneTextures}
      />
    </div>
  );
}
