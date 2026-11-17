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

    // "la tapa tiene otro color... no se si vos modificas el color" — every
    // VISIBLE mesh gets the same true-color treatment now, not just the one
    // carrying the logo: a product is routinely more than one mesh (a
    // bottle's cap vs. its body, say), and only ever fixing the actively
    // personalized mesh left every other part of the same model on the old,
    // plain-lit material — fine on its own, but visibly mismatched in
    // brightness/tint next to a now-corrected neighbor.
    for (const mesh of meshes) {
      if (otherMeshNames.includes(mesh.name) && mesh.name !== activeMeshName) {
        // A hidden color-variant mesh for a different color — a no-op when
        // the product has no variant mesh names at all.
        mesh.visible = false;
        continue;
      }

      let entry = bakeStateRef.current.get(mesh.name);
      if (!entry) {
        const original = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
        if (!(original instanceof THREE.MeshStandardMaterial) && !(original instanceof THREE.MeshBasicMaterial)) {
          continue;
        }
        const baseColorHex = `#${original.color.getHexString()}`;
        // Our own copy to mutate from here on — the shared cached material
        // (and its texture/metalness/roughness/normal maps) never gets
        // touched, so it stays the real, pristine base for every future
        // bake, including in a brand-new Product3DViewer mount later.
        const material = original.clone() as typeof original;
        // Reset the diffuse tint to white: `map` texels get multiplied by
        // `color` component-wise, and the canvas below already starts from
        // this material's real base color/photo (see baseImage/baseColorHex
        // above), so nothing should multiply/darken it a second time.
        material.color.set(0xffffff);
        if (material instanceof THREE.MeshStandardMaterial) {
          // "le sacaste el efecto de iluminacion que tenia antes (la azul)"
          // — making this mesh fully unlit (MeshBasicMaterial, the previous
          // fix for "en la botella se ve mal") stopped the N·L falloff from
          // ever darkening it below the true color, but also threw away
          // every bit of shading, so the bottle lost the metallic
          // highlight/gradient it has in the reference render. Give the
          // real lit material an emissive floor instead, equal to its own
          // true texture (its own map, unless this is the actively
          // personalized mesh — see below): emissive alone already
          // guarantees every point reads at least as bright as the real
          // photo regardless of curvature or light angle, while the normal
          // lit diffuse/specular response on top can only ADD extra
          // brightness (a highlight) — never subtract.
          material.emissiveIntensity = 1;
          if (material.map) {
            material.emissive.set(0xffffff);
            material.emissiveMap = material.map;
          } else {
            // "sumaste problemas nuevos" — a plain-color mesh (no texture,
            // like a bottle cap) has no map to drive a per-texel emissive
            // floor, so `emissive = white` made its floor flat WHITE
            // regardless of its real color — the cap stopped looking like
            // a cap at all, reading the same light gray as the body next
            // to it. The floor has to be this mesh's own true color
            // instead, not an assumed white.
            material.emissive.set(baseColorHex);
          }
        }
        entry = {
          material,
          baseImage: material.map?.image as HTMLImageElement | HTMLCanvasElement | ImageBitmap | undefined,
          baseColorHex,
        };
        bakeStateRef.current.set(mesh.name, entry);
      }
      mesh.material = entry.material;
    }

    if (!activeMeshName || zoneTextures.length === 0) return;
    const entry = bakeStateRef.current.get(activeMeshName);
    if (!entry) return;
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
      if (material instanceof THREE.MeshStandardMaterial) {
        // Same bitmap drives the emissive floor (see the emissive setup
        // above) as drives the lit diffuse response, so the logo itself
        // reads at full true color even in a shadowed area, not just the
        // surrounding base color. Always reset emissive to white first: if
        // this mesh originally had no map (a plain-color base, like the
        // cap-color case above), the initial setup left `emissive` at this
        // mesh's own baseColorHex — left as-is, that would multiply this
        // already-true-color canvas by baseColorHex a second time, the
        // same "velo" bug all over again.
        material.emissive.set(0xffffff);
        material.emissiveMap = newTexture;
      }
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
        {/* Every visible mesh now carries its own emissive floor (see
            Model's bake effect above) equal to its true texture, so these
            lights no longer have to single-handedly guarantee a minimum
            brightness — that was the old problem: any ambient/directional
            ratio strong enough to keep a curved surface's shadowed side (a
            bottle) at true color blew out a flatter one (a notebook
            cover), and the reverse. They only need to add a believable
            highlight on top of that floor now, which is additive on top of
            an already-100%-bright surface: "el plateado no respeta el
            color" — kept at the earlier intensities, a near-white color
            like silver had almost no headroom left before this extra
            light pushed it past white and clipped, reading flat/washed-out
            instead of a true metallic silver. Dialed down well below that
            so the added highlight stays a subtle sheen, not a wash. */}
        <ambientLight intensity={0.25} />
        <directionalLight position={[5, 5, 5]} intensity={0.35} />
        <directionalLight position={[-5, -3, -5]} intensity={0.15} />
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
