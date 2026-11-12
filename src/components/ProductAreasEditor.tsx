"use client";

import Image from "next/image";
import { PrintAreaTool, type Quad } from "./PrintAreaTool";

const DEFAULT_CORNERS: Quad = [
  { x: 30, y: 35 },
  { x: 70, y: 35 },
  { x: 70, y: 60 },
  { x: 30, y: 60 },
];

// The persisted shape of one product_print_zones row, as far as the admin/
// supplier forms need it (no id/product_id — those are assigned on save).
export type UvBox = { u0: number; v0: number; u1: number; v1: number };

export type AreaInput = {
  label: string;
  width: number;
  height: number;
  maxChars: number;
  corners: Quad;
  imageId: string | null;
  extraPrice: number;
  // Where this area's design gets composited onto the product's 3D mesh,
  // in UV space (0..1) — null until an admin/supplier sets it, which skips
  // this area in the 3D viewer (see "Ver en 3D" in ProductConfigurator).
  glbUvBox: UvBox | null;
};

const DEFAULT_UV_BOX: UvBox = { u0: 0.3, v0: 0.3, u1: 0.7, v1: 0.6 };

export type AreaDraft = AreaInput & { localId: string };

function randomLocalId() {
  return Math.random().toString(36).slice(2);
}

// Builds the form's initial area list: the product's existing areas (order
// preserved — index 0 is always the primary/main area) if it has any, or a
// single fresh primary area otherwise (new product, or an existing one with
// no print area configured yet).
export function toAreaDrafts(areas: AreaInput[] | undefined, fallbackImageId: string | null): AreaDraft[] {
  if (areas && areas.length > 0) {
    return areas.map((a) => ({ ...a, localId: randomLocalId() }));
  }
  return [
    {
      localId: randomLocalId(),
      label: "Main area",
      width: 60,
      height: 30,
      maxChars: 24,
      corners: DEFAULT_CORNERS,
      imageId: fallbackImageId,
      extraPrice: 0,
      glbUvBox: null,
    },
  ];
}

function newExtraArea(fallbackImageId: string | null): AreaDraft {
  return {
    localId: randomLocalId(),
    label: "",
    width: 60,
    height: 30,
    maxChars: 24,
    corners: DEFAULT_CORNERS,
    imageId: fallbackImageId,
    extraPrice: 0,
    glbUvBox: null,
  };
}

// Lets the admin/supplier configure the product's primary print area plus
// any number of optional secondary/tertiary ones — each with its own
// reference photo, its own freeform print-area quad, and (for anything past
// the primary) a per-unit surcharge for the shopper to add it. Index 0 is
// always the primary area: always included, never removable, no surcharge.
export function ProductAreasEditor({
  areas,
  onChange,
  images,
  hasGlb = false,
}: {
  areas: AreaDraft[];
  onChange: (areas: AreaDraft[]) => void;
  images: { id: string; url: string }[];
  // Shows each area's 3D UV-box fields only once a GLB is actually
  // attached — otherwise they'd be dead inputs with nothing to apply to.
  hasGlb?: boolean;
}) {
  const updateArea = (index: number, patch: Partial<AreaDraft>) => {
    onChange(areas.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  };
  const addArea = () => onChange([...areas, newExtraArea(images[0]?.id ?? null)]);
  const removeArea = (index: number) => onChange(areas.filter((_, i) => i !== index));

  return (
    <div className="space-y-6">
      {areas.map((area, index) => {
        const isPrimary = index === 0;
        const resolvedImageUrl =
          images.find((img) => img.id === area.imageId)?.url ?? images[0]?.url ?? null;
        return (
          <div key={area.localId} className={index > 0 ? "pt-5 border-t border-line" : undefined}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs uppercase tracking-wide text-muted">
                {isPrimary ? "Main print area" : "Additional print area"}
              </p>
              {!isPrimary && (
                <button
                  type="button"
                  onClick={() => removeArea(index)}
                  className="text-xs text-terracotta-dark"
                >
                  Remove
                </button>
              )}
            </div>

            {!isPrimary && (
              <input
                placeholder="Area name (e.g. Back, Sleeve)"
                value={area.label}
                onChange={(e) => updateArea(index, { label: e.target.value })}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm mb-3 focus:outline-none focus:border-dark"
              />
            )}

            {images.length > 1 && (
              <div className="mb-3">
                <label className="text-xs uppercase tracking-wide text-muted block mb-2">
                  Reference photo for this area
                </label>
                <div className="flex gap-2">
                  {images.map((img) => (
                    <button
                      key={img.id}
                      type="button"
                      onClick={() => updateArea(index, { imageId: img.id })}
                      className={`relative h-14 w-14 rounded-lg overflow-hidden border-2 ${
                        area.imageId === img.id ? "border-terracotta" : "border-transparent"
                      }`}
                    >
                      <Image
                        src={img.url}
                        alt=""
                        fill
                        className="object-cover"
                        unoptimized={img.id.startsWith("pending:")}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs uppercase tracking-wide text-muted mb-2">
              Drag the shape to move it, drag any corner to reshape it (useful when the surface is at
              an angle in the photo)
            </p>
            <PrintAreaTool
              imageUrl={resolvedImageUrl}
              corners={area.corners}
              onChange={(corners) => updateArea(index, { corners })}
              sizeLabel={`${area.width} × ${area.height}mm`}
            />
            <div className="grid grid-cols-3 gap-3 mt-3">
              <div>
                <label className="text-xs text-muted block mb-1">Width (mm)</label>
                <input
                  type="number"
                  value={area.width}
                  onChange={(e) => updateArea(index, { width: Number(e.target.value) })}
                  className="w-full rounded-lg border border-line px-3 py-2 focus:outline-none focus:border-dark"
                />
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Height (mm)</label>
                <input
                  type="number"
                  value={area.height}
                  onChange={(e) => updateArea(index, { height: Number(e.target.value) })}
                  className="w-full rounded-lg border border-line px-3 py-2 focus:outline-none focus:border-dark"
                />
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Max chars/line</label>
                <input
                  type="number"
                  value={area.maxChars}
                  onChange={(e) => updateArea(index, { maxChars: Number(e.target.value) })}
                  className="w-full rounded-lg border border-line px-3 py-2 focus:outline-none focus:border-dark"
                />
              </div>
            </div>

            {!isPrimary && (
              <div className="mt-3">
                <label className="text-xs text-muted block mb-1">
                  Extra charge to add this area ($/unit)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={area.extraPrice}
                  onChange={(e) => updateArea(index, { extraPrice: Number(e.target.value) })}
                  className="w-40 rounded-lg border border-line px-3 py-2 focus:outline-none focus:border-dark"
                />
              </div>
            )}

            {hasGlb && (
              <div className="mt-3 pt-3 border-t border-line">
                <label className="flex items-center gap-2 text-xs text-muted mb-2">
                  <input
                    type="checkbox"
                    checked={!!area.glbUvBox}
                    onChange={(e) =>
                      updateArea(index, { glbUvBox: e.target.checked ? DEFAULT_UV_BOX : null })
                    }
                  />
                  Show this area in the 3D viewer
                </label>
                {area.glbUvBox && (
                  <>
                    <p className="text-xs text-muted mb-2">
                      UV coordinates (0–1) of this area on the 3D model&apos;s own texture — ask
                      whoever prepared the GLB for these.
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                      {(["u0", "v0", "u1", "v1"] as const).map((key) => (
                        <div key={key}>
                          <label className="text-xs text-muted block mb-1 uppercase">{key}</label>
                          <input
                            type="number"
                            step="0.01"
                            min={0}
                            max={1}
                            value={area.glbUvBox![key]}
                            onChange={(e) =>
                              updateArea(index, {
                                glbUvBox: { ...area.glbUvBox!, [key]: Number(e.target.value) },
                              })
                            }
                            className="w-full rounded-lg border border-line px-2 py-1.5 text-sm focus:outline-none focus:border-dark"
                          />
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}

      <button type="button" onClick={addArea} className="text-xs text-terracotta font-medium">
        + Add another print area (e.g. back, sleeve)
      </button>
    </div>
  );
}
