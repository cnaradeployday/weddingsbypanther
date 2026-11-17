"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";

export type ZoneTextureInput = {
  // Where this zone's artwork lands on the active mesh's own texture, in
  // UV space (0–1) — set by an admin/supplier per print area.
  uvBox: { u0: number; v0: number; u1: number; v1: number };
  // The logo/text artwork for this zone ALONE, on a transparent background
  // (see personalizationComposite.ts's `artwork` return and the
  // /api/personalization-snapshot route) — not the full photo. Drawing
  // only this (rather than a crop of the full composited photo) is what
  // keeps the print area itself invisible on the model: everywhere outside
  // the real ink pixels stays transparent, so the mesh's own material
  // shows through unchanged.
  artworkDataUrl: string;
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

  // "borre el logo anterior, subi otro, pero en el 3d me guardo el anterior
  // y lo super puso" — scene.clone(true) deep-clones the mesh hierarchy but
  // NOT materials: every mesh in `cloned` still points at the exact same
  // Material object drei's GLTF loader cache shares across every mount of
  // this glbUrl, for the lifetime of the page. Baking straight onto
  // `material.map` (as this used to) mutated that one shared material, so
  // the NEXT bake (a new logo, a Refresh, even just reopening the viewer)
  // started from the PREVIOUS bake's result instead of the model's real
  // texture — stacking every design on top of the last forever. Cloning
  // the material once per mesh name, the first time it's needed, and
  // remembering its true pristine base layer separately (captured at that
  // same moment, before any mutation) means every later bake always
  // starts over from the real texture, replacing rather than layering.
  const bakeStateRef = useRef(
    new Map<
      string,
      {
        material: THREE.MeshStandardMaterial | THREE.MeshBasicMaterial;
        baseImage?: HTMLImageElement | HTMLCanvasElement | ImageBitmap;
        baseColorHex: string;
      }
    >()
  );
  useEffect(() => {
    bakeStateRef.current = new Map();
  }, [cloned]);

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

    let entry = bakeStateRef.current.get(activeMeshName);
    if (!entry) {
      const original = Array.isArray(targetMesh.material) ? targetMesh.material[0] : targetMesh.material;
      if (!(original instanceof THREE.MeshStandardMaterial) && !(original instanceof THREE.MeshBasicMaterial)) {
        return;
      }
      // Our own copy to mutate from here on — the shared cached material
      // (and its texture) never gets touched, so it stays the real,
      // pristine base for every future bake, including in a brand-new
      // Product3DViewer mount later.
      const material = original.clone() as typeof original;
      entry = {
        material,
        baseImage: material.map?.image as HTMLImageElement | HTMLCanvasElement | ImageBitmap | undefined,
        baseColorHex: `#${material.color.getHexString()}`,
      };
      bakeStateRef.current.set(activeMeshName, entry);
    }
    targetMesh.material = entry.material;
    const material = entry.material;
    const { baseImage, baseColorHex } = entry;

    let cancelled = false;
    (async () => {
      const width = baseImage?.width ?? 1024;
      const height = baseImage?.height ?? 1024;

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      if (baseImage) {
        ctx.drawImage(baseImage, 0, 0, width, height);
      } else {
        // No existing base texture (a plain-color material) — start from
        // that color instead of leaving the canvas transparent.
        ctx.fillStyle = baseColorHex;
        ctx.fillRect(0, 0, width, height);
      }

      const loaded = await Promise.all(
        zoneTextures.map(async (zt) => {
          try {
            return { zt, img: await loadHtmlImage(zt.artworkDataUrl) };
          } catch {
            return null;
          }
        })
      );
      if (cancelled) return;

      for (const loadedEntry of loaded) {
        if (!loadedEntry) continue;
        const { zt, img } = loadedEntry;
        const dx = zt.uvBox.u0 * width;
        const dy = zt.uvBox.v0 * height;
        const dw = Math.max(1, (zt.uvBox.u1 - zt.uvBox.u0) * width);
        const dh = Math.max(1, (zt.uvBox.v1 - zt.uvBox.v0) * height);
        // The artwork is already just the logo/text on a transparent
        // background, sized to the print zone's own bounding box — a plain
        // stretch-to-fit draw, no cropping/warping needed, and the
        // transparent pixels outside the ink leave the mesh's real texture
        // showing through everywhere else in this rectangle.
        ctx.drawImage(img, dx, dy, dw, dh);
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
        // "el color se ve mas oscuro, como si hubiera una transparencia" /
        // "el logo se configuro en blanco pero se ve gris" — react-three-
        // fiber's Canvas defaults to ACESFilmicToneMapping, which rolls off
        // highlights and mutes saturated colors (a pure white reads as a
        // light gray, a saturated red reads darker) — exactly this
        // symptom. `flat` switches the renderer to NoToneMapping, so a
        // material's real color comes through unchanged, matching the
        // flat product photo it's being compared against.
        flat
      >
        {/* "el fondo tiene que ser blanco para que tenga contraste" */}
        <color attach="background" args={["#ffffff"]} />
        {/* "se sigue viendo opacado" — `flat` (above) removed the tone-
            mapping darkening, but MeshStandardMaterial's Lambertian BRDF
            divides by π, so the previous lights (summing to ~2.0 at a
            best-lit point) only reached ~64% of the texture's real color.
            Pushed well past π (~3.14) so a lit surface reads at or above
            its true albedo, matching the flat reference photo.
            "el color se veia apago... ahora lo vuelvo a ver en una botella"
            — on a curved surface (a bottle, vs. the flatter notebook cover
            this was first tuned against), the directional lights' N·L
            falloff still visibly darkens the sides even though the
            front-most point reads correctly: a saturated, dark color (navy
            blue) shows that falloff as a "veil" much more than a mid-tone
            red did. Made ambient — which has no falloff, the same at every
            point on the surface — the dominant term instead of the
            directional lights, so the curve's sides stay close to the
            front's brightness; the directional lights are now just a soft
            highlight rather than the main light source. */}
        <ambientLight intensity={3.4} />
        <directionalLight position={[5, 5, 5]} intensity={1} />
        <directionalLight position={[-5, -3, -5]} intensity={0.6} />
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
