// QR tool validation (EDIT-13). A minimum scannable size is explicitly
// meant to come from product/technique configuration ("that minimum must
// come from configuration... if it doesn't exist, report it") — no such
// field exists anywhere in the schema (see DISCOVERY.md gap #2), so this
// module deliberately does NOT enforce one. It only validates the URL
// itself, which doesn't depend on that missing configuration.

export function isValidQrUrl(rawUrl: string): boolean {
  const trimmed = rawUrl.trim();
  if (!trimmed) return false;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
