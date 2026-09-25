import { describe, it, expect } from "vitest";
import { computeValidationIssues, hasBlockingIssues } from "./purchaseFlowValidation";

function baseInput(overrides: Partial<Parameters<typeof computeValidationIssues>[0]> = {}) {
  return {
    names: "Amelia & Ravi",
    quantityInput: "25",
    minOrder: 25,
    checklistConfirmed: true,
    hasLogo: true,
    logoIsLowRes: false,
    hiddenElements: [],
    ...overrides,
  };
}

describe("computeValidationIssues", () => {
  it("returns no issues for a fully valid, confirmed, high-res design with a logo", () => {
    expect(computeValidationIssues(baseInput())).toEqual([]);
  });

  it("blocks on empty names, tagged to the names element", () => {
    const issues = computeValidationIssues(baseInput({ names: "" }));
    expect(issues).toContainEqual({ level: "blocking", elemKey: "names", message: expect.any(String) });
  });

  it("blocks on a quantity below the minimum", () => {
    const issues = computeValidationIssues(baseInput({ quantityInput: "10", minOrder: 25 }));
    expect(issues.some((i) => i.level === "blocking" && i.message.includes("25"))).toBe(true);
  });

  it("blocks when the checklist isn't confirmed", () => {
    const issues = computeValidationIssues(baseInput({ checklistConfirmed: false }));
    expect(issues.some((i) => i.level === "blocking" && i.message.toLowerCase().includes("checklist"))).toBe(true);
  });

  it("warns (not blocks) on a low-resolution logo", () => {
    const issues = computeValidationIssues(baseInput({ logoIsLowRes: true }));
    expect(issues).toContainEqual({ level: "warning", elemKey: "logo", message: expect.any(String) });
  });

  it("warns on every hidden-but-present element", () => {
    const issues = computeValidationIssues(
      baseInput({ hiddenElements: [{ key: "frame", label: "Frame" }, { key: "qr", label: "QR code" }] })
    );
    expect(issues.filter((i) => i.level === "warning" && i.elemKey === "frame")).toHaveLength(1);
    expect(issues.filter((i) => i.level === "warning" && i.elemKey === "qr")).toHaveLength(1);
  });

  it("shows an info note when no logo was added, not a warning or block", () => {
    const issues = computeValidationIssues(baseInput({ hasLogo: false, logoIsLowRes: false }));
    expect(issues).toContainEqual({ level: "info", message: expect.any(String) });
    expect(issues.some((i) => i.level !== "info")).toBe(false);
  });

  it("never warns about resolution when there's no logo at all", () => {
    const issues = computeValidationIssues(baseInput({ hasLogo: false, logoIsLowRes: true }));
    expect(issues.some((i) => i.elemKey === "logo")).toBe(false);
  });
});

describe("hasBlockingIssues", () => {
  it("is true only when at least one issue is blocking", () => {
    expect(hasBlockingIssues([{ level: "info", message: "x" }])).toBe(false);
    expect(hasBlockingIssues([{ level: "warning", message: "x" }])).toBe(false);
    expect(hasBlockingIssues([{ level: "blocking", message: "x" }])).toBe(true);
  });
});
