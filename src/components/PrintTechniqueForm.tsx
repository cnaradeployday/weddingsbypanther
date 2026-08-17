"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type InitialPrintTechnique = {
  id: string;
  name: string;
  finishDescription: string;
  colorModeDescription: string;
  sortOrder: number;
  stripSourceColor: boolean;
};

export function PrintTechniqueForm({ initial }: { initial?: InitialPrintTechnique }) {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState(initial?.name ?? "");
  const [finishDescription, setFinishDescription] = useState(
    initial?.finishDescription ?? "a clean printed finish"
  );
  const [colorModeDescription, setColorModeDescription] = useState(
    initial?.colorModeDescription ?? "Match the color treatment to a realistic printed finish."
  );
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0);
  const [stripSourceColor, setStripSourceColor] = useState(initial?.stripSourceColor ?? false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload = {
      name,
      finish_description: finishDescription,
      color_mode_description: colorModeDescription,
      sort_order: sortOrder,
      strip_source_color: stripSourceColor,
    };

    const { error: saveError } = initial
      ? await supabase.from("print_techniques").update(payload).eq("id", initial.id)
      : await supabase.from("print_techniques").insert(payload);

    if (saveError) {
      setError(saveError.message);
      setSubmitting(false);
      return;
    }

    router.push("/admin/print-techniques");
    router.refresh();
  };

  const handleDelete = async () => {
    if (!initial) return;
    if (!confirm(`Delete "${initial.name}"? Products already using it keep the name, but it won't be offered as an option anymore.`))
      return;
    setDeleting(true);
    const { error: deleteError } = await supabase.from("print_techniques").delete().eq("id", initial.id);
    if (deleteError) {
      setError(deleteError.message);
      setDeleting(false);
      return;
    }
    router.push("/admin/print-techniques");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      <div className="rounded-xl border border-line bg-white p-6 space-y-4">
        <div>
          <label className="text-xs uppercase tracking-wide text-muted block mb-1">Name</label>
          <input
            required
            placeholder="e.g. Laser engrave"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-muted block mb-1">Sort order</label>
          <input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value))}
            className="w-32 rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark"
          />
        </div>
      </div>

      <div className="rounded-xl border border-line bg-white p-6 space-y-4">
        <p className="text-xs uppercase tracking-wide text-muted">AI render guidance</p>
        <p className="text-xs text-muted -mt-2">
          These two fields are fed straight into the AI render prompt so the preview matches how this
          technique actually looks physically produced.
        </p>
        <div>
          <label className="text-xs text-muted block mb-1">Finish description</label>
          <textarea
            required
            rows={2}
            placeholder="e.g. a subtly debossed, burned-in engraved look with soft inner shadow, no ink color"
            value={finishDescription}
            onChange={(e) => setFinishDescription(e.target.value)}
            className="w-full rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark"
          />
        </div>
        <div>
          <label className="text-xs text-muted block mb-1">Color mode rule</label>
          <textarea
            required
            rows={5}
            placeholder="Describe exactly how much of the artwork's original color should survive this technique — most physical techniques can't reproduce full color."
            value={colorModeDescription}
            onChange={(e) => setColorModeDescription(e.target.value)}
            className="w-full rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark"
          />
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={stripSourceColor}
            onChange={(e) => setStripSourceColor(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            This technique physically can&apos;t reproduce color — pre-convert any uploaded logo/photo to
            grayscale before sending it to the AI. Stronger than the color mode rule above (which only
            asks nicely); use this for strictly monochrome techniques where even a small colored detail
            (like a logo&apos;s accent dot) must never survive.
          </span>
        </label>
      </div>

      {error && <p className="text-sm text-terracotta-dark">{error}</p>}

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-3 rounded-full bg-dark text-cream-light text-sm font-medium hover:bg-dark-soft transition-colors disabled:opacity-50"
        >
          {submitting ? "Saving…" : initial ? "Save changes" : "Create technique"}
        </button>
        {initial && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="text-sm text-terracotta-dark disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete technique"}
          </button>
        )}
      </div>
    </form>
  );
}
