"use client";

// EDIT-03's canvas controls: zoom, "Fit", guides/grid toggles and reset —
// one floating blurred pill anchored to the bottom of the stage, per the
// Product Customizer iOS redesign (design_handoff_product_customizer).
// Zoom is purely a view transform — it never touches `design`.

// 50 used to be the lowest step, which meant the zoom-out button and the
// dropdown could never go below it — "no me deja ir a menos del 50%".
export const ZOOM_STEPS = [10, 25, 50, 75, 100, 125, 150, 200, 300];

export function CanvasControls({
  zoomPct,
  onZoomChange,
  onFit,
  guidesOn,
  onToggleGuides,
  gridOn,
  onToggleGrid,
  onReset,
}: {
  zoomPct: number;
  onZoomChange: (pct: number) => void;
  onFit: () => void;
  guidesOn: boolean;
  onToggleGuides: () => void;
  gridOn: boolean;
  onToggleGrid: () => void;
  onReset?: () => void;
}) {
  const stepZoom = (dir: 1 | -1) => {
    const idx = ZOOM_STEPS.findIndex((s) => s >= zoomPct);
    const nextIdx = dir === 1 ? Math.min(ZOOM_STEPS.length - 1, (idx === -1 ? ZOOM_STEPS.length - 1 : idx) + 1) : Math.max(0, idx - 1);
    onZoomChange(ZOOM_STEPS[nextIdx]);
  };

  const divider = <span className="w-px h-5 mx-0.5 shrink-0" style={{ background: "var(--pc-ink-200)" }} aria-hidden="true" />;
  const pillBtn = (extra = "") =>
    `h-[34px] px-3.5 rounded-full text-[13px] shrink-0 transition-colors hover:bg-[var(--pc-ink-50)] ${extra}`;

  return (
    <div
      className="flex items-center gap-0.5 p-[5px] rounded-full flex-wrap justify-center"
      style={{
        background: "rgba(255,255,255,0.86)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "1px solid var(--pc-border-subtle)",
        boxShadow: "var(--pc-shadow-md)",
      }}
    >
      <button type="button" aria-label="Zoom out" onClick={() => stepZoom(-1)} className="w-[34px] h-[34px] rounded-full grid place-items-center shrink-0 transition-colors hover:bg-[var(--pc-ink-50)]" style={{ color: "var(--pc-ink-700)" }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M5 12h14" />
        </svg>
      </button>
      <label className="sr-only" htmlFor="zoom-select">
        Zoom level
      </label>
      <select
        id="zoom-select"
        value={zoomPct}
        onChange={(e) => onZoomChange(Number(e.target.value))}
        className="w-14 text-center text-[13px] bg-transparent shrink-0"
        style={{ color: "var(--pc-ink-950)" }}
      >
        {ZOOM_STEPS.map((s) => (
          <option key={s} value={s}>
            {s}%
          </option>
        ))}
      </select>
      <button type="button" aria-label="Zoom in" onClick={() => stepZoom(1)} className="w-[34px] h-[34px] rounded-full grid place-items-center shrink-0 transition-colors hover:bg-[var(--pc-ink-50)]" style={{ color: "var(--pc-ink-700)" }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M5 12h14M12 5v14" />
        </svg>
      </button>
      {divider}
      <button type="button" onClick={onFit} className={pillBtn()} style={{ color: "var(--pc-ink-700)" }}>
        Fit
      </button>
      <button
        type="button"
        onClick={onToggleGuides}
        aria-pressed={guidesOn}
        className={pillBtn()}
        style={{ background: guidesOn ? "var(--pc-ink-950)" : "transparent", color: guidesOn ? "#fff" : "var(--pc-ink-700)" }}
      >
        Guides
      </button>
      <button
        type="button"
        onClick={onToggleGrid}
        aria-pressed={gridOn}
        className={pillBtn()}
        style={{ background: gridOn ? "var(--pc-ink-950)" : "transparent", color: gridOn ? "#fff" : "var(--pc-ink-700)" }}
      >
        Grid
      </button>
      {onReset && (
        <>
          {divider}
          <button type="button" onClick={onReset} className={pillBtn()} style={{ color: "var(--pc-danger)" }}>
            Reset
          </button>
        </>
      )}
    </div>
  );
}
