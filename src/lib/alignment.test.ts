import { describe, it, expect } from "vitest";
import { alignHorizontal, alignVertical } from "./alignment";

describe("alignHorizontal", () => {
  it("left places the element's edge, not its center, at 0", () => {
    expect(alignHorizontal("left", 8)).toBe(8);
  });

  it("right places the element's edge at 100", () => {
    expect(alignHorizontal("right", 8)).toBe(92);
  });

  it("center is always 50 regardless of size", () => {
    expect(alignHorizontal("center", 8)).toBe(50);
    expect(alignHorizontal("center", 30)).toBe(50);
  });
});

describe("alignVertical", () => {
  it("top/bottom/middle mirror the horizontal cases on the y axis", () => {
    expect(alignVertical("top", 5)).toBe(5);
    expect(alignVertical("bottom", 5)).toBe(95);
    expect(alignVertical("middle", 5)).toBe(50);
  });
});
