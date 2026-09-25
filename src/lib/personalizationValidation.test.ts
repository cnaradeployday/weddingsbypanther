import { describe, it, expect } from "vitest";
import { isNamesValid, NAMES_REQUIRED_MESSAGE } from "./personalizationValidation";

describe("isNamesValid", () => {
  it("rejects an empty string", () => {
    expect(isNamesValid("")).toBe(false);
  });

  it("rejects whitespace-only input", () => {
    expect(isNamesValid("   \n\t  ")).toBe(false);
  });

  it("accepts any non-whitespace character", () => {
    expect(isNamesValid("A")).toBe(true);
  });

  it("accepts normal names text", () => {
    expect(isNamesValid("Amelia & Ravi")).toBe(true);
  });

  it("accepts text that is only whitespace around real content", () => {
    expect(isNamesValid("  Amelia & Ravi  ")).toBe(true);
  });
});

describe("NAMES_REQUIRED_MESSAGE", () => {
  it("is a non-empty user-facing string", () => {
    expect(NAMES_REQUIRED_MESSAGE.length).toBeGreaterThan(0);
  });
});
