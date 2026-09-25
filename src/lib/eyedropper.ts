// Wraps the browser EyeDropper API (EDIT-07: "eyedropper — only where the
// browser supports the EyeDropper API; hide it otherwise"). Not implemented
// in every browser (notably Firefox and Safari as of this writing), so
// every caller must check `isEyeDropperSupported()` before showing the
// button at all, rather than showing it and failing on click.

export function isEyeDropperSupported(): boolean {
  return typeof window !== "undefined" && "EyeDropper" in window;
}

// Resolves to a "#rrggbb" hex string, or null if the user cancelled (Esc)
// or picking failed for any other reason.
export async function pickColorWithEyedropper(): Promise<string | null> {
  if (!isEyeDropperSupported()) return null;
  try {
    // Not in lib.dom.d.ts yet in all TS versions this project might build
    // with — constructed dynamically rather than typed against a global.
    const EyeDropperCtor = (window as unknown as { EyeDropper: new () => { open(): Promise<{ sRGBHex: string }> } })
      .EyeDropper;
    const result = await new EyeDropperCtor().open();
    return result.sRGBHex;
  } catch {
    // User pressed Esc, or the browser refused (e.g. not a user gesture).
    return null;
  }
}
