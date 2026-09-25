// The fixed, non-user-selectable printed date format (BUG-08) —
// MM·DD·YYYY, e.g. "06·14·2026" for June 14, 2026 — used both for the live
// preview/print output and, since BUG-08, for what the date field itself
// displays, so the two always match regardless of the visiting browser's
// locale.
export function formatPrintDate(dateIso: string): string {
  if (!dateIso) return "";
  const d = new Date(dateIso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return dateIso;
  return d
    .toLocaleDateString("en-US", { day: "2-digit", month: "2-digit", year: "numeric" })
    .replace(/\//g, "·");
}
