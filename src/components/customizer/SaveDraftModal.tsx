"use client";

import { useState } from "react";

// Prompts for a name before saving the current design as its own new,
// separate draft (see ProductConfigurator.tsx's handleSaveDraft) — each
// save creates an independent copy rather than overwriting the last one, so
// a name is what lets the customer tell several saved drafts apart later in
// "My Drafts."
export function SaveDraftModal({
  saving,
  onCancel,
  onConfirm,
}: {
  saving: boolean;
  onCancel: () => void;
  onConfirm: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const trimmed = name.trim();

  return (
    <div role="dialog" aria-modal="true" aria-label="Save draft" className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (trimmed) onConfirm(trimmed);
        }}
        className="w-full max-w-sm rounded-2xl bg-white shadow-xl p-6 flex flex-col gap-4"
      >
        <div>
          <h2 className="font-serif text-2xl mb-1">Save draft</h2>
          <p className="text-sm text-muted">Give this design a name so you can find it again in My Drafts.</p>
        </div>
        <div>
          <label htmlFor="draft-name" className="text-xs uppercase tracking-wide text-muted block mb-2">
            Logo name
          </label>
          <input
            id="draft-name"
            autoFocus
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Blue logo, front"
            className="w-full rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark"
          />
        </div>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg border border-line text-sm">
            Cancel
          </button>
          <button
            type="submit"
            disabled={!trimmed || saving}
            className="px-4 py-2 rounded-lg bg-terracotta text-cream-light text-sm disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save draft"}
          </button>
        </div>
      </form>
    </div>
  );
}
