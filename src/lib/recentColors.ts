// "Recent colors" swatches (EDIT-07's color panel). The list-update logic
// is a pure function (testable); persistence is a thin localStorage layer
// around it — losing this list if storage is unavailable is harmless (it's
// a convenience, not design data), so it's not routed through BUG-01's
// fail-soft IndexedDB module.

export const MAX_RECENT_COLORS = 6;

export function addRecentColor(recent: string[], hex: string): string[] {
  const normalized = hex.toLowerCase();
  const deduped = recent.filter((c) => c.toLowerCase() !== normalized);
  return [normalized, ...deduped].slice(0, MAX_RECENT_COLORS);
}

const STORAGE_KEY = "bespoke-recent-colors";

export function loadRecentColors(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((c) => typeof c === "string").slice(0, MAX_RECENT_COLORS) : [];
  } catch {
    return [];
  }
}

export function saveRecentColors(colors: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(colors));
  } catch {
    // Best-effort — not design data, safe to drop silently.
  }
}
