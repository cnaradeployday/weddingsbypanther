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

  // React's useReducer dispatch doesn't accept a function updater the way
  // useState's does, so a functional update is computed here against the
  // current `design` before dispatching a plain "set" action.
  const setDesign = useCallback(
    (updater: Design | ((prev: Design) => Design)) => {
      const value = typeof updater === "function" ? (updater as (p: Design) => Design)(design) : updater;
      dispatch({ type: "set", value });
    },
    [design]
  );

  const setDesignCoalescing = useCallback(
    (updater: Design | ((prev: Design) => Design)) => {
      const value = typeof updater === "function" ? (updater as (p: Design) => Design)(design) : updater;
      dispatch({ type: "set", value, coalesce: true });
    },
    [design]
  );

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
