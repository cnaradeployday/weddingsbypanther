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
  // `value` may be a plain value or a functional updater (receiving the
  // current `present`) — the updater form lets the dispatcher stay a stable
  // function identity across renders (no closure over `present` needed),
  // which matters a lot for a handler subscribed inside a `useEffect`: a
  // dispatcher that changes identity on every call — e.g. one that closes
  // over `present` directly — forces that effect to tear down and
  // re-subscribe its listeners on every single dispatch, which is exactly
  // what happens many times a second during a drag/rotate gesture.
  | { type: "set"; value: T | ((prev: T) => T); coalesce?: boolean }
  | { type: "undo" }
  | { type: "redo" }
  // Loads a different design (e.g. switching print zones) without it being
  // an undoable step itself, and without carrying over unrelated history.
  | { type: "replace"; value: T }
  // Ends the current gesture (pointerup after a drag/resize/rotate, blur
  // after a typing run) without changing `present` — so the *next*
  // coalesced "set" starts a fresh step instead of silently merging into
  // whatever gesture came before it. Without this, two separate drags
  // back-to-back (both dispatched with coalesce: true) would merge into
  // one undo step, since nothing else ever turns coalescing back off.
  | { type: "commit" };

// "at least 50 steps" (EDIT-05) — kept generously above that so ordinary use
// never silently loses history, while still bounding memory.
export const MAX_HISTORY_STEPS = 100;

export function initHistory<T>(initial: T): HistoryState<T> {
  return { past: [], present: initial, future: [], coalescing: false };
}

export function historyReducer<T>(state: HistoryState<T>, action: HistoryAction<T>): HistoryState<T> {
  switch (action.type) {
    case "set": {
      const nextValue =
        typeof action.value === "function" ? (action.value as (prev: T) => T)(state.present) : action.value;
      if (action.coalesce && state.coalescing) {
        return { ...state, present: nextValue, future: [] };
      }
      const past = [...state.past, state.present].slice(-MAX_HISTORY_STEPS);
      return { past, present: nextValue, future: [], coalescing: !!action.coalesce };
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
    case "commit":
      return state.coalescing ? { ...state, coalescing: false } : state;
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
