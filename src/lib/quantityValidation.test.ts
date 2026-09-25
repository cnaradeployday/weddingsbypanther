import { describe, it, expect } from "vitest";
import { parseQuantityInput, isQuantityBelowMinimum } from "./quantityValidation";

describe("parseQuantityInput", () => {
  it("parses a plain positive integer", () => {
    expect(parseQuantityInput("25")).toBe(25);
  });

  it("rounds a decimal", () => {
    expect(parseQuantityInput("25.6")).toBe(26);
  });

  it("returns null for empty or whitespace-only input", () => {
    expect(parseQuantityInput("")).toBeNull();
    expect(parseQuantityInput("   ")).toBeNull();
  });

  it("returns null for zero, negative, or non-numeric input", () => {
    expect(parseQuantityInput("0")).toBeNull();
    expect(parseQuantityInput("-5")).toBeNull();
    expect(parseQuantityInput("abc")).toBeNull();
  });
});

describe("isQuantityBelowMinimum — BUG-09", () => {
  it("flags a value below the minimum", () => {
    expect(isQuantityBelowMinimum("10", 25)).toBe(true);
  });

  it("does not flag a value at or above the minimum", () => {
    expect(isQuantityBelowMinimum("25", 25)).toBe(false);
    expect(isQuantityBelowMinimum("50", 25)).toBe(false);
  });

  it("flags invalid input the same way as below-minimum", () => {
    expect(isQuantityBelowMinimum("", 25)).toBe(true);
    expect(isQuantityBelowMinimum("abc", 25)).toBe(true);
    expect(isQuantityBelowMinimum("-3", 25)).toBe(true);
  });
});
