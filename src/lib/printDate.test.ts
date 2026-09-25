import { describe, it, expect } from "vitest";
import { formatPrintDate } from "./printDate";

describe("formatPrintDate — BUG-08", () => {
  it("formats as MM·DD·YYYY regardless of month/day order in the ISO input", () => {
    expect(formatPrintDate("2026-06-14")).toBe("06·14·2026");
  });

  it("zero-pads single-digit months and days", () => {
    expect(formatPrintDate("2026-01-05")).toBe("01·05·2026");
  });

  it("returns an empty string for no date", () => {
    expect(formatPrintDate("")).toBe("");
  });

  it("falls back to the raw input for an unparseable date", () => {
    expect(formatPrintDate("not-a-date")).toBe("not-a-date");
  });

  it("is independent of any particular browser/OS locale — always MM·DD·YYYY", () => {
    // The whole point of BUG-08: the native <input type="date"> renders in
    // the visitor's locale (e.g. DD/MM/YYYY in most of the world), but the
    // printed product always uses this fixed US month-first order — this
    // function is what both the preview and the fixed-format display use,
    // so it must never depend on Intl's locale-detection, only the literal
    // "en-US" passed explicitly.
    expect(formatPrintDate("2026-12-25")).toBe("12·25·2026");
  });
});
