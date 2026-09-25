"use client";

import { useCallback, useMemo, useReducer } from "react";
import { historyReducer, initHistory, canUndo, canRedo } from "@/lib/designHistory";
import type { Design, ElemKey } from "./types";

// Wraps the generic undo/redo history (designHistory.ts) around one
// product's live Design (EDIT-05). Every mutation goes through `set` (a
// fresh undo step) or `setCoalescing` (merges into the current gesture's
// step — a typing run or a continuous drag) so the whole editor shares one
// consistent history instead of each tool managing its own.
export function useDesignReducer(initial: Design) {
  const [history, dispatch] = useReducer(historyReducer<Design>, initial, initHistory);

  const design = history.present;

  // Passes a functional updater straight through to the reducer (which now
  // accepts one — see designHistory.ts) instead of computing it here against
  // a closured `design`. That keeps these two functions' identity
  // permanently stable across renders (empty deps — `dispatch` itself never
  // changes), matching the guarantee `useState`'s own setter gives.
  //
  // This isn't just tidiness: `setDesignCoalescing` is a dependency of the
  // drag/resize/rotate pointermove effects. A version that closed over
  // `design` (and so got a new identity on every dispatch — i.e. many times
  // a second during a drag) forced those effects to tear down and
  // re-subscribe their window pointermove/pointerup listeners on every
  // single frame of the gesture, which is what made dragging, rotating and
  // resizing effectively not work at all.
  const setDesign = useCallback((updater: Design | ((prev: Design) => Design)) => {
    dispatch({ type: "set", value: updater });
  }, []);

  const setDesignCoalescing = useCallback((updater: Design | ((prev: Design) => Design)) => {
    dispatch({ type: "set", value: updater, coalesce: true });
  }, []);

  const replaceDesign = useCallback((value: Design) => {
    dispatch({ type: "replace", value });
  }, []);

  const undo = useCallback(() => dispatch({ type: "undo" }), []);
  const redo = useCallback(() => dispatch({ type: "redo" }), []);
  // Call on pointerup/blur after a drag, resize, rotate, or typing run —
  // see designHistory.ts's "commit" action for why this is needed.
  const commitGesture = useCallback(() => dispatch({ type: "commit" }), []);

  return useMemo(
    () => ({
      design,
      setDesign,
      setDesignCoalescing,
      replaceDesign,
      undo,
      redo,
      commitGesture,
      canUndo: canUndo(history),
      canRedo: canRedo(history),
    }),
    [design, setDesign, setDesignCoalescing, replaceDesign, undo, redo, commitGesture, history]
  );
}

// Small helpers for the common "update one element's position/scale/
// rotation" shape every drag/resize/rotate handler needs — kept here so
// every call site doesn't hand-roll the same spread.
export function withPosition(design: Design, key: ElemKey, pos: { x: number; y: number }): Design {
  return { ...design, positions: { ...design.positions, [key]: pos } };
}

export function withScale(design: Design, key: ElemKey, scale: number): Design {
  return { ...design, elemScale: { ...design.elemScale, [key]: scale } };
}

export function withRotationOffset(design: Design, key: ElemKey, deg: number): Design {
  return { ...design, elemRotationOffset: { ...design.elemRotationOffset, [key]: deg } };
}

export function withOrderBroughtToFront(design: Design, key: ElemKey): Design {
  if (design.elemOrder[design.elemOrder.length - 1] === key) return design;
  return { ...design, elemOrder: [...design.elemOrder.filter((k) => k !== key), key] };
}
