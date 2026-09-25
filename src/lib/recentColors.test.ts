import { describe, it, expect } from "vitest";
import { addRecentColor, MAX_RECENT_COLORS } from "./recentColors";

describe("addRecentColor", () => {
  it("adds a new color to the front", () => {
    expect(addRecentColor([], "#ff0000")).toEqual(["#ff0000"]);
    expect(addRecentColor(["#00ff00"], "#ff0000")).toEqual(["#ff0000", "#00ff00"]);
  });

  it("moves an existing color to the front instead of duplicating it", () => {
    expect(addRecentColor(["#ff0000", "#00ff00"], "#00ff00")).toEqual(["#00ff00", "#ff0000"]);
  });

  it("is case-insensitive when deduping", () => {
    expect(addRecentColor(["#FF0000"], "#ff0000")).toEqual(["#ff0000"]);
  });

  it("caps the list at the maximum", () => {
    const full = Array.from({ length: MAX_RECENT_COLORS }, (_, i) => `#00000${i}`);
    const result = addRecentColor(full, "#ffffff");
    expect(result).toHaveLength(MAX_RECENT_COLORS);
    expect(result[0]).toBe("#ffffff");
  });
});
