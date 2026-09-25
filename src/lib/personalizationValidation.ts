// Shared pre-cart validation for a design's required fields — used by the
// product page (BUG-02) and reused by the Review step's validation engine
// (03-purchase-flow.md FLOW-06) so both places agree on the same rule.

export const NAMES_REQUIRED_MESSAGE = "Add your names or event text to continue.";

// "Your names or event text" is the only required personalization field —
// everything else (logo, monogram, frame, date) is optional. Whitespace-only
// input doesn't count as content.
export function isNamesValid(names: string): boolean {
  return names.trim().length > 0;
}
