import { describe, it, expect } from "vitest";
import { isValidQrUrl } from "./qrValidation";

describe("isValidQrUrl", () => {
  it("accepts a plain https URL", () => {
    expect(isValidQrUrl("https://example.com")).toBe(true);
  });

  it("accepts http", () => {
    expect(isValidQrUrl("http://example.com/path?x=1")).toBe(true);
  });

  it("rejects an empty or whitespace-only string", () => {
    expect(isValidQrUrl("")).toBe(false);
    expect(isValidQrUrl("   ")).toBe(false);
  });

  it("rejects a non-URL string", () => {
    expect(isValidQrUrl("not a url")).toBe(false);
  });

  it("rejects a non-http(s) scheme", () => {
    expect(isValidQrUrl("javascript:alert(1)")).toBe(false);
    expect(isValidQrUrl("mailto:a@b.com")).toBe(false);
  });

  it("trims surrounding whitespace before validating", () => {
    expect(isValidQrUrl("  https://example.com  ")).toBe(true);
  });
});
