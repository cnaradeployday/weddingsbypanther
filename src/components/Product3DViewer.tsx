"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";

export type ZoneTextureInput = {
  // Percentages (0–100) of the composited photo this zone's design was
  // rendered against — the same corners_pct the 2D canvas/overlay already
  // uses, reused here to crop out just this zone's region.
  cornersPct: { x: number; y: number }[];
  // Where that cropped region lands on the active mesh's own texture, in
  // UV space (0–1) — set by an admin/supplier per print area.
  uvBox: { u0: number; v0: number; u1: number; v1: number };
  // The already-composited (photo + logo/text) PNG for this zone, fetched
  // the same way the 2D Preview/Confirmación steps do (see
  // useCompositedPreview.ts) — reused as-is rather than re-implementing
  // logo/text rendering in WebGL.
  imageDataUrl: string;
};

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load composited design image"));
    img.src = src;
  });
}

// Warps the quad (top-left, top-right, _, bottom-left — the 4th corner is
// unused, matching the rest of this app's parallelogram approximation of a
// freeform quad) out of `img` into a fresh `destW`×`destH` canvas. An affine
// map, not a true perspective warp, so it's exact for an axis-aligned
// rectangle and a reasonable approximation for the mild skews this editor's
// corner-drag tool actually produces.
function warpQuadToCanvas(
  img: HTMLImageElement,
  quad: { x: number; y: number }[],
  destW: number,
  destH: number
): HTMLCanvasElement | null {
  if (quad.length !== 4) return null;
  const [tl, tr, , bl] = quad;
  const toPx = (c: { x: number; y: number }) => ({
    x: (c.x / 100) * img.naturalWidth,
    y: (c.y / 100) * img.naturalHeight,
  });
  const srcTL = toPx(tl);
  const srcTR = toPx(tr);
  const srcBL = toPx(bl);

  const ux = srcTR.x - srcTL.x;
  const uy = srcTR.y - srcTL.y;
  const vx = srcBL.x - srcTL.x;
  const vy = srcBL.y - srcTL.y;
  const det = ux * vy - vx * uy;
  if (Math.abs(det) < 1e-6) return null;

  // [a c; b d] takes raw image-pixel coordinates straight to this dest
  // canvas's own pixel coordinates — derived by solving the 3-point affine
  // correspondence srcTL->(0,0), srcTR->(destW,0), srcBL->(0,destH).
  const invA = vy / det;
  const invB = -uy / det;
  const invC = -vx / det;
  const invD = ux / det;
  const a = destW * invA;
  const c = destW * invC;
  const b = destH * invB;
  const d = destH * invD;
  const e = -(a * srcTL.x + c * srcTL.y);
  const f = -(b * srcTL.x + d * srcTL.y);

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(destW));
  canvas.height = Math.max(1, Math.round(destH));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(a, b, c, d, e, f);
  ctx.drawImage(img, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return canvas;
}

function Model({
  glbUrl,
  activeMeshName,
  otherMeshNames,
  zoneTextures,
  onFit,
}: {
  glbUrl: string;
  activeMeshName: string | null;
  otherMeshNames: string[];
  zoneTextures: ZoneTextureInput[];
  onFit: (maxDim: number) => void;
}) {
  const { scene } = useGLTF(glbUrl);
  const { camera } = useThree();
  // A fresh clone per mount so repeated opens of the viewer (or opening it
  // for a different variant) never accumulate baked-texture state onto a
  // scene drei caches and reuses across mounts.
  const cloned = useMemo(() => scene.clone(true), [scene]);

  // "se ve muy lejos el producto" — a GLB can come in at any real-world
  // scale/units and be positioned anywhere, so a fixed camera distance (the
  // previous [0,0,3]) only worked by coincidence. Centers the model at the
  // origin and points the camera at it from a distance proportional to the
  // model's own size instead of a guessed constant.
  useEffect(() => {
    const box = new THREE.Box3().setFromObject(cloned);
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    cloned.position.sub(center);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const dist = maxDim * 1.8;
    camera.position.set(0, 0, dist);
    camera.lookAt(0, 0, 0);
    if (camera instanceof THREE.PerspectiveCamera) {
      // react-hooks/immutability assumes a hook's return value is
      // React-owned and read-only, but useThree()'s camera is the live
      // three.js scene object react-three-fiber is built around mutating
      // directly (every r3f/drei example does this) — not the kind of
      // value this rule's assumption is meant to guard.
      // eslint-disable-next-line react-hooks/immutability
      camera.near = dist / 100;
      camera.far = dist * 100;
      camera.updateProjectionMatrix();
    }
    onFit(maxDim);
  }, [cloned, camera, onFit]);

  useEffect(() => {
    const meshes: THREE.Mesh[] = [];
    cloned.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) meshes.push(obj as THREE.Mesh);
    });

    // Hide every other known color-variant mesh so only the active color
    // shows — a no-op when the product has no variant mesh names at all.
    for (const mesh of meshes) {
      if (otherMeshNames.includes(mesh.name) && mesh.name !== activeMeshName) {
        mesh.visible = false;
      }
    }

    if (!activeMeshName || zoneTextures.length === 0) return;
    const targetMesh = meshes.find((m) => m.name === activeMeshName);
    if (!targetMesh) return;
    const material = Array.isArray(targetMesh.material) ? targetMesh.material[0] : targetMesh.material;
    if (!(material instanceof THREE.MeshStandardMaterial) && !(material instanceof THREE.MeshBasicMaterial)) {
      return;
    }

    let cancelled = false;
    (async () => {
      const baseTexture = material.map;
      const baseImage = baseTexture?.image as HTMLImageElement | ImageBitmap | undefined;
      const width = baseImage?.width ?? 1024;
      const height = baseImage?.height ?? 1024;

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      if (baseImage) {
        ctx.drawImage(baseImage as CanvasImageSource, 0, 0, width, height);
      } else {
        // No existing base texture (a plain-color material) — start from
        // that color instead of leaving the canvas transparent.
        ctx.fillStyle = `#${material.color.getHexString()}`;
        ctx.fillRect(0, 0, width, height);
      }

      const loaded = await Promise.all(
        zoneTextures.map(async (zt) => {
          try {
            return { zt, img: await loadHtmlImage(zt.imageDataUrl) };
          } catch {
            return null;
          }
        })
      );
      if (cancelled) return;

      for (const entry of loaded) {
        if (!entry) continue;
        const { zt, img } = entry;
        const dx = zt.uvBox.u0 * width;
        const dy = zt.uvBox.v0 * height;
        const dw = Math.max(1, (zt.uvBox.u1 - zt.uvBox.u0) * width);
        const dh = Math.max(1, (zt.uvBox.v1 - zt.uvBox.v0) * height);
        const warped = warpQuadToCanvas(img, zt.cornersPct, dw, dh);
        if (warped) ctx.drawImage(warped, dx, dy, dw, dh);
      }

      const newTexture = new THREE.CanvasTexture(canvas);
      // Matches the original glTF texture's own convention (top-left
      // origin, same as the canvas we just drew into) — CanvasTexture
      // defaults flipY to true, which would otherwise mirror every zone
      // vertically on the model.
      newTexture.flipY = false;
      newTexture.colorSpace = THREE.SRGBColorSpace;
      newTexture.needsUpdate = true;
      material.map = newTexture;
      material.needsUpdate = true;
    })();

    return () => {
      cancelled = true;
    };
    // zoneTextures is a fresh array/object graph each time the caller
    // re-fetches snapshots (see Product3DViewer's own effect) — deep
    // equality isn't needed since that only happens on an explicit
    // Refresh, not on every render.
  }, [cloned, activeMeshName, otherMeshNames, zoneTextures]);

  return <primitive object={cloned} />;
}

export function Product3DViewer({
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
  const [failed, setFailed] = useState(false);
  // Set once the model's own size is known (see Model's fit effect) so
  // OrbitControls' zoom limits — and the +/- buttons below — scale with
  // the model instead of assuming a fixed unit size.
  const [maxDim, setMaxDim] = useState<number | null>(null);
  const controlsRef = useRef<OrbitControlsImpl>(null);

  // "agregale una herramienta de zoom tambien" — scroll/pinch already zooms
  // (OrbitControls' own enableZoom), but an explicit +/- control is easier
  // to discover, especially on a trackpad.
  const zoomIn = () => {
    controlsRef.current?.dollyIn(1.3);
    controlsRef.current?.update();
  };
  const zoomOut = () => {
    controlsRef.current?.dollyOut(1.3);
    controlsRef.current?.update();
  };

  if (failed) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted">
        Could not load the 3D model.
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <Canvas
        camera={{ position: [0, 0, 3], fov: 40 }}
        onError={() => setFailed(true)}
        className="!h-full !w-full"
      >
        {/* "el fondo tiene que ser blanco para que tenga contraste" */}
        <color attach="background" args={["#ffffff"]} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[5, 5, 5]} intensity={1.3} />
        <directionalLight position={[-5, -3, -5]} intensity={0.4} />
        <Suspense fallback={null}>
          <Model
            glbUrl={glbUrl}
            activeMeshName={activeMeshName}
            otherMeshNames={otherMeshNames}
            zoneTextures={zoneTextures}
            onFit={setMaxDim}
          />
        </Suspense>
        <OrbitControls
          ref={controlsRef}
          enablePan={false}
          minDistance={maxDim ? maxDim * 0.4 : undefined}
          maxDistance={maxDim ? maxDim * 6 : undefined}
        />
      </Canvas>
      <div className="absolute bottom-3 right-3 flex flex-col rounded-full border border-line bg-white shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={zoomIn}
          aria-label="Zoom in"
          className="h-9 w-9 flex items-center justify-center text-dark hover:bg-cream"
        >
          +
        </button>
        <div className="h-px bg-line" />
        <button
          type="button"
          onClick={zoomOut}
          aria-label="Zoom out"
          className="h-9 w-9 flex items-center justify-center text-dark hover:bg-cream"
        >
          −
        </button>
      </div>
    </div>
  );
}
