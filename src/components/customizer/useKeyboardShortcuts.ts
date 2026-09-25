"use client";

import { useEffect } from "react";
import type { ElemKey } from "./types";

// EDIT-06: arrow keys move the selected element (Shift for a bigger step),
// Delete/Backspace removes it (when removable), Esc deselects, undo/redo
// shortcuts, all ignored while focus is in a text input so typing isn't
// hijacked.
export function useKeyboardShortcuts({
  activeElem,
  locked,
  onNudge,
  onDelete,
  onDeselect,
  onUndo,
  onRedo,
}: {
  activeElem: ElemKey | null;
  locked: boolean;
  onNudge: (dx: number, dy: number) => void;
  onDelete: () => void;
  onDeselect: () => void;
  onUndo: () => void;
  onRedo: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

      const meta = e.metaKey || e.ctrlKey;
      if (meta && !isTyping && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) onRedo();
        else onUndo();
        return;
      }
      if (meta && !isTyping && e.key.toLowerCase() === "y") {
        e.preventDefault();
        onRedo();
        return;
      }
      if (isTyping) return;

      if (e.key === "Escape") {
        onDeselect();
        return;
      }
      if (!activeElem || locked) return;

      const step = e.shiftKey ? 3 : 0.5;
      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          onNudge(-step, 0);
          break;
        case "ArrowRight":
          e.preventDefault();
          onNudge(step, 0);
          break;
        case "ArrowUp":
          e.preventDefault();
          onNudge(0, -step);
          break;
        case "ArrowDown":
          e.preventDefault();
          onNudge(0, step);
          break;
        case "Delete":
        case "Backspace":
          e.preventDefault();
          onDelete();
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeElem, locked, onNudge, onDelete, onDeselect, onUndo, onRedo]);
}
