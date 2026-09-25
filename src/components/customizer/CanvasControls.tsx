"use client";

// EDIT-03's bottom-left canvas controls: zoom, "Fit", guides and grid
// toggles. Zoom is purely a view transform — it never touches `design`.

export const ZOOM_STEPS = [50, 75, 100, 125, 150, 200, 300];

export function CanvasControls({
  zoomPct,
  onZoomChange,
  onFit,
  guidesOn,
  onToggleGuides,
  gridOn,
  onToggleGrid,
}: {
  zoomPct: number;
  onZoomChange: (pct: number) => void;
  onFit: () => void;
  guidesOn: boolean;
  onToggleGuides: () => void;
  gridOn: boolean;
  onToggleGrid: () => void;
}) {
  const stepZoom = (dir: 1 | -1) => {
    const idx = ZOOM_STEPS.findIndex((s) => s >= zoomPct);
    const nextIdx = dir === 1 ? Math.min(ZOOM_STEPS.length - 1, (idx === -1 ? ZOOM_STEPS.length - 1 : idx) + 1) : Math.max(0, idx - 1);
    onZoomChange(ZOOM_STEPS[nextIdx]);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center h-11 bg-white border border-line rounded-lg">
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => stepZoom(-1)}
          className="w-11 h-full text-lg text-dark"
        >
          −
        </button>
        <label className="sr-only" htmlFor="zoom-select">
          Zoom level
        </label>
        <select
          id="zoom-select"
          value={zoomPct}
          onChange={(e) => onZoomChange(Number(e.target.value))}
          className="w-16 text-center text-sm bg-transparent"
        >
          {ZOOM_STEPS.map((s) => (
            <option key={s} value={s}>
              {s}%
            </option>
          ))}
        </select>
        <button type="button" aria-label="Zoom in" onClick={() => stepZoom(1)} className="w-11 h-full text-lg text-dark">
          +
        </button>
      </div>
      <button
        type="button"
        onClick={onFit}
        className="h-11 px-3.5 border border-line bg-white rounded-lg text-sm text-dark"
      >
        Fit
      </button>
      <button
        type="button"
        onClick={onToggleGuides}
        aria-pressed={guidesOn}
        className={`h-11 px-3.5 rounded-lg text-sm border ${
          guidesOn ? "border-terracotta bg-[#F7F4FF] text-[#4520B8]" : "border-line bg-white text-dark"
        }`}
      >
        Guides
      </button>
      <button
        type="button"
        onClick={onToggleGrid}
        aria-pressed={gridOn}
        className={`h-11 px-3.5 rounded-lg text-sm border ${
          gridOn ? "border-terracotta bg-[#F7F4FF] text-[#4520B8]" : "border-line bg-white text-dark"
        }`}
      >
        Grid
      </button>
    </div>
  );
}
