"use client";

import type { ElemKey } from "./types";

export type ToolId = Exclude<ElemKey, never> | "layers" | "technique";

const TOOL_ICONS: Record<ToolId, React.ReactNode> = {
  names: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7V5h16v2" />
      <path d="M12 5v14" />
      <path d="M9 19h6" />
    </svg>
  ),
  logo: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="2" />
      <path d="M21 16l-5-5-8 9" />
    </svg>
  ),
  frame: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="12" rx="7" ry="9" />
    </svg>
  ),
  monogram: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 15V9l4 4 4-4v6" />
    </svg>
  ),
  date: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  ),
  qr: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <path d="M14 14h3v3h-3zM20 14v7M14 20h3" />
    </svg>
  ),
  layers: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l9 5-9 5-9-5 9-5z" />
      <path d="M3 13l9 5 9-5" />
    </svg>
  ),
  technique: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h12v6l-3 3v9H9v-9L6 9V3z" />
    </svg>
  ),
};

const TOOL_LABELS: Record<ToolId, string> = {
  names: "Text",
  logo: "Logo",
  frame: "Frame",
  monogram: "Monogram",
  date: "Date",
  qr: "QR",
  layers: "Layers",
  technique: "Technique",
};

export function ToolRail({
  availableTools,
  activeTool,
  onSelectTool,
  orientation = "vertical",
}: {
  availableTools: ToolId[];
  activeTool: ToolId | null;
  onSelectTool: (tool: ToolId) => void;
  orientation?: "vertical" | "horizontal";
}) {
  const mainTools = availableTools.filter((t) => t !== "layers");
  const hasLayers = availableTools.includes("layers");

  const button = (tool: ToolId) => {
    const active = activeTool === tool;
    return (
      <button
        key={tool}
        type="button"
        onClick={() => onSelectTool(tool)}
        aria-label={TOOL_LABELS[tool]}
        aria-pressed={active}
        className={`flex flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium transition-colors ${
          orientation === "vertical" ? "h-16" : "h-full min-w-[64px] px-2"
        } ${active ? "bg-[#EEE9FF] text-[#4520B8]" : "text-muted hover:bg-cream"}`}
      >
        {TOOL_ICONS[tool]}
        <span>{TOOL_LABELS[tool]}</span>
      </button>
    );
  };

  if (orientation === "horizontal") {
    return (
      <nav
        aria-label="Tools"
        className="flex items-center gap-1 overflow-x-auto px-2 py-1 bg-white border-t border-line"
      >
        {mainTools.map(button)}
        {hasLayers && button("layers")}
      </nav>
    );
  }

  return (
    <nav aria-label="Tools" className="flex w-[88px] shrink-0 flex-col gap-1.5 bg-white border-r border-line p-2">
      {mainTools.map(button)}
      <div className="flex-1" />
      {hasLayers && button("layers")}
    </nav>
  );
}
