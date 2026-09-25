import { describe, it, expect } from "vitest";
import { historyReducer, initHistory, canUndo, canRedo, MAX_HISTORY_STEPS } from "./designHistory";

describe("designHistory — EDIT-05 undo/redo", () => {
  it("starts with nothing to undo or redo", () => {
    const state = initHistory(0);
    expect(canUndo(state)).toBe(false);
    expect(canRedo(state)).toBe(false);
  });

  it("undoes back to the previous value and redoes forward again", () => {
    let state = initHistory(0);
    state = historyReducer(state, { type: "set", value: 1 });
    state = historyReducer(state, { type: "set", value: 2 });
    expect(state.present).toBe(2);

    state = historyReducer(state, { type: "undo" });
    expect(state.present).toBe(1);
    state = historyReducer(state, { type: "undo" });
    expect(state.present).toBe(0);
    expect(canUndo(state)).toBe(false);

    state = historyReducer(state, { type: "redo" });
    expect(state.present).toBe(1);
    state = historyReducer(state, { type: "redo" });
    expect(state.present).toBe(2);
    expect(canRedo(state)).toBe(false);
  });

  it("undo/redo are no-ops at either end of history", () => {
    const state = initHistory(0);
    expect(historyReducer(state, { type: "undo" })).toEqual(state);
    expect(historyReducer(state, { type: "redo" })).toEqual(state);
  });

  it("a new edit after undoing clears redo — the standard branching-history rule", () => {
    let state = initHistory(0);
    state = historyReducer(state, { type: "set", value: 1 });
    state = historyReducer(state, { type: "set", value: 2 });
    state = historyReducer(state, { type: "undo" }); // present: 1, future: [2]
    state = historyReducer(state, { type: "set", value: 99 });
    expect(state.present).toBe(99);
    expect(canRedo(state)).toBe(false);
  });

  it("coalesces consecutive updates in the same gesture into one undo step", () => {
    let state = initHistory("");
    // A run of keystrokes, or a continuous drag — every intermediate value
    // is `coalesce: true`.
    state = historyReducer(state, { type: "set", value: "A", coalesce: true });
    state = historyReducer(state, { type: "set", value: "Am", coalesce: true });
    state = historyReducer(state, { type: "set", value: "Amelia", coalesce: true });
    expect(state.present).toBe("Amelia");
    expect(state.past).toEqual([""]); // only the pre-gesture value, one step

    state = historyReducer(state, { type: "undo" });
    expect(state.present).toBe(""); // the whole typing run undoes in one step
  });

  it("starts a new step for a set that isn't marked coalesce, even right after a coalesced one", () => {
    let state = initHistory("");
    state = historyReducer(state, { type: "set", value: "A", coalesce: true });
    state = historyReducer(state, { type: "set", value: "B" }); // a distinct, separate edit
    expect(state.past).toEqual(["", "A"]);
    expect(state.present).toBe("B");
  });

  it("replace loads a new value without it being undoable and drops old history", () => {
    let state = initHistory(0);
    state = historyReducer(state, { type: "set", value: 1 });
    state = historyReducer(state, { type: "replace", value: 42 });
    expect(state.present).toBe(42);
    expect(canUndo(state)).toBe(false);
    expect(canRedo(state)).toBe(false);
  });

  it("supports at least 50 undo steps", () => {
    let state = initHistory(0);
    for (let i = 1; i <= 60; i++) {
      state = historyReducer(state, { type: "set", value: i });
    }
    let undoCount = 0;
    while (canUndo(state)) {
      state = historyReducer(state, { type: "undo" });
      undoCount++;
    }
    expect(undoCount).toBeGreaterThanOrEqual(50);
    expect(undoCount).toBeLessThanOrEqual(MAX_HISTORY_STEPS);
  });
});
