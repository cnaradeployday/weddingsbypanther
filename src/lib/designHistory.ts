// Generic undo/redo history (EDIT-05). Kept independent of what it stores —
// the customizer uses it with its full per-zone Design object, but nothing
// here knows that shape.
//
// Coalescing: "consecutive typing and continuous drags are grouped into one
// step" is implemented by the caller passing `coalesce: true` on every
// intermediate update of one gesture (a keystroke run, a pointer drag) and
// `coalesce: false` (or omitted) on the update that starts a new one. While
// coalescing, further "set"s replace the in-flight present instead of
// pushing a new history entry; a plain "set" (or the first of a new
// gesture) always pushes one.

export type HistoryState<T> = {
  past: T[];
  present: T;
  future: T[];
  coalescing: boolean;
};

export type HistoryAction<T> =
  | { type: "set"; value: T; coalesce?: boolean }
  | { type: "undo" }
  | { type: "redo" }
  // Loads a different design (e.g. switching print zones) without it being
  // an undoable step itself, and without carrying over unrelated history.
  | { type: "replace"; value: T };

// "at least 50 steps" (EDIT-05) — kept generously above that so ordinary use
// never silently loses history, while still bounding memory.
export const MAX_HISTORY_STEPS = 100;

export function initHistory<T>(initial: T): HistoryState<T> {
  return { past: [], present: initial, future: [], coalescing: false };
}

export function historyReducer<T>(state: HistoryState<T>, action: HistoryAction<T>): HistoryState<T> {
  switch (action.type) {
    case "set": {
      if (action.coalesce && state.coalescing) {
        return { ...state, present: action.value, future: [] };
      }
      const past = [...state.past, state.present].slice(-MAX_HISTORY_STEPS);
      return { past, present: action.value, future: [], coalescing: !!action.coalesce };
    }
    case "undo": {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return {
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future].slice(0, MAX_HISTORY_STEPS),
        coalescing: false,
      };
    }
    case "redo": {
      if (state.future.length === 0) return state;
      const [next, ...rest] = state.future;
      return {
        past: [...state.past, state.present].slice(-MAX_HISTORY_STEPS),
        present: next,
        future: rest,
        coalescing: false,
      };
    }
    case "replace":
      return { past: [], present: action.value, future: [], coalescing: false };
    default:
      return state;
  }
}

export function canUndo<T>(state: HistoryState<T>): boolean {
  return state.past.length > 0;
}

export function canRedo<T>(state: HistoryState<T>): boolean {
  return state.future.length > 0;
}
