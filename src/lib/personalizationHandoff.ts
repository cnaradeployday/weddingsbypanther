// Carries the in-progress names/date/monogram/logo from one product's
// configurator to another when a customer clicks a suggested/related
// product, so the next product opens pre-filled instead of blank —
// sessionStorage rather than a query string since the logo is a data URL,
// too large for a URL and not meaningful to expose there. Read-once: the
// destination consumes and clears it, so it never re-applies to a later,
// unrelated visit.
const KEY = "bespoke:personalizationHandoff";

export type PersonalizationHandoff = {
  names: string;
  date: string;
  monogram: string;
  logoDataUrl: string | null;
  frame: string;
  textFont: string;
  elemScale: Record<string, number>;
};

export function savePersonalizationHandoff(data: PersonalizationHandoff) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // sessionStorage unavailable (private mode, etc.) — the click still
    // navigates, it just won't prefill.
  }
}

export function consumePersonalizationHandoff(): PersonalizationHandoff | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    return JSON.parse(raw) as PersonalizationHandoff;
  } catch {
    return null;
  }
}
