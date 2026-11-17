import type { StorefrontTemplateId } from "@/lib/storefrontTemplates";

// A small abstract wireframe standing in for a full screenshot of each
// storefront template — "que se vean en el back office con una preview"
// — cheap to keep in sync with each layout (just shapes, no real copy or
// live data) while still making the three look clearly different at a
// glance.
export function TemplatePreview({ templateId }: { templateId: StorefrontTemplateId }) {
  if (templateId === "modern") {
    return (
      <div className="aspect-[4/3] rounded-lg overflow-hidden border border-line bg-cream p-2 flex flex-col gap-1.5">
        <div className="flex-1 rounded bg-line/70 relative">
          <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 h-2 w-10 rounded-full bg-dark/70" />
        </div>
        <div className="flex gap-1">
          <div className="h-2 w-6 rounded-full bg-line" />
          <div className="h-2 w-6 rounded-full bg-line" />
          <div className="h-2 w-6 rounded-full bg-line" />
        </div>
        <div className="flex gap-1 h-6">
          <div className="flex-1 rounded bg-line/50" />
          <div className="flex-1 rounded bg-line/50" />
          <div className="flex-1 rounded bg-line/50" />
        </div>
      </div>
    );
  }

  if (templateId === "bold") {
    return (
      <div className="aspect-[4/3] rounded-lg overflow-hidden border border-line bg-cream p-2 flex flex-col gap-1.5">
        <div className="h-8 rounded bg-dark flex items-center justify-center">
          <div className="h-1.5 w-12 rounded-full bg-terracotta" />
        </div>
        <div className="h-3 rounded bg-line/60" />
        <div className="flex gap-1">
          <div className="flex-1 h-4 rounded bg-terracotta" />
          <div className="flex-1 h-4 rounded bg-sage" />
          <div className="flex-1 h-4 rounded bg-gold" />
          <div className="flex-1 h-4 rounded bg-dark" />
        </div>
        <div className="flex gap-1 flex-1">
          <div className="flex-1 rounded bg-line/50" />
          <div className="flex-1 rounded bg-line/50" />
        </div>
      </div>
    );
  }

  if (templateId === "editorial") {
    return (
      <div className="aspect-[4/3] rounded-lg overflow-hidden border border-line bg-cream p-2 flex flex-col gap-1.5">
        <div className="h-3 border-b-2 border-dark/70" />
        <div className="flex gap-1.5 flex-1">
          <div className="w-4 flex flex-col gap-1 pt-0.5">
            <div className="h-1 w-3 rounded-full bg-line" />
            <div className="h-1 w-3 rounded-full bg-line" />
            <div className="h-1 w-3 rounded-full bg-line" />
          </div>
          <div className="flex-1 rounded-sm bg-line/60" />
          <div className="flex-1 flex flex-col gap-1">
            <div className="flex-1 rounded-sm bg-line/40" />
            <div className="flex-1 rounded-sm bg-line/40" />
          </div>
        </div>
      </div>
    );
  }

  if (templateId === "minimal") {
    return (
      <div className="aspect-[4/3] rounded-lg overflow-hidden border border-line bg-cream p-2 flex flex-col items-center gap-2 pt-3">
        <div className="h-1.5 w-16 rounded-full bg-dark/50" />
        <div className="h-1 w-10 rounded-full bg-line" />
        <div className="flex gap-2 mt-1">
          <div className="h-1 w-5 rounded-full bg-line" />
          <div className="h-1 w-5 rounded-full bg-line" />
          <div className="h-1 w-5 rounded-full bg-line" />
        </div>
        <div className="grid grid-cols-4 gap-1 w-full mt-1">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="aspect-square rounded-sm bg-line/50" />
          ))}
        </div>
      </div>
    );
  }

  if (templateId === "gallery") {
    return (
      <div className="aspect-[4/3] rounded-lg overflow-hidden border border-line bg-cream p-2 flex flex-col gap-1.5">
        <div className="h-10 rounded bg-dark/70" />
        <div className="flex gap-1.5 flex-1">
          <div className="w-3 flex flex-col gap-1">
            <div className="h-1 w-full rounded-full bg-line" />
            <div className="h-1 w-full rounded-full bg-line" />
          </div>
          <div className="flex-1 rounded-sm bg-line/50" />
          <div className="flex-1 flex flex-col gap-1">
            <div className="flex-1 rounded-sm bg-line/60" />
            <div className="h-3 rounded-sm bg-line/40" />
          </div>
          <div className="flex-1 rounded-sm bg-line/50" />
        </div>
      </div>
    );
  }

  if (templateId === "boutique") {
    return (
      <div className="aspect-[4/3] rounded-lg overflow-hidden border border-line bg-cream p-2 flex flex-col gap-1.5">
        <div className="flex gap-1.5 flex-1">
          <div className="flex-1 rounded-xl bg-line/60" />
          <div className="flex-1 flex flex-col items-center justify-center gap-1">
            <div className="h-px w-5 bg-gold" />
            <div className="h-1.5 w-10 rounded-full bg-dark/50" />
            <div className="h-px w-5 bg-gold" />
          </div>
        </div>
        <div className="flex gap-1 justify-center">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-3 w-3 rounded-full border border-gold" />
          ))}
        </div>
      </div>
    );
  }

  if (templateId === "playful") {
    return (
      <div className="aspect-[4/3] rounded-lg overflow-hidden border border-line bg-cream p-2 flex flex-col items-center gap-1.5">
        <div className="h-10 w-[85%] rounded-3xl bg-line/60 rotate-1" />
        <div className="flex gap-1">
          <div className="h-2.5 w-7 rounded-full bg-terracotta/70" />
          <div className="h-2.5 w-6 rounded-full bg-gold/70" />
          <div className="h-2.5 w-8 rounded-full bg-sage/70" />
        </div>
        <div className="grid grid-cols-4 gap-1 w-full">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="aspect-square rounded-lg bg-line/50" style={{ transform: i % 2 ? "rotate(-3deg)" : "rotate(3deg)" }} />
          ))}
        </div>
      </div>
    );
  }

  if (templateId === "grid") {
    return (
      <div className="aspect-[4/3] rounded-lg overflow-hidden border border-dark bg-cream p-0 flex flex-col">
        <div className="flex h-8 border-b border-dark">
          <div className="flex-1 bg-line/60 border-r border-dark" />
          <div className="flex-1 border-r border-dark" />
          <div className="flex-1" />
        </div>
        <div className="flex h-4 border-b border-dark">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex-1 border-r border-dark last:border-r-0" />
          ))}
        </div>
        <div className="grid grid-cols-4 flex-1">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="border-r border-b border-line last:border-r-0 bg-line/40" />
          ))}
        </div>
      </div>
    );
  }

  if (templateId === "showcase") {
    return (
      <div className="aspect-[4/3] rounded-lg overflow-hidden border border-line bg-cream p-2 flex flex-col gap-1.5">
        <div className="h-8 rounded-t bg-line/60" />
        <div className="h-3 bg-dark rounded-b -mt-1.5" />
        <div className="grid grid-cols-2 gap-1 h-6">
          <div className="rounded bg-line/50" />
          <div className="rounded bg-line/50" />
        </div>
        <div className="flex gap-1 flex-1">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex-1 rounded bg-line/40" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="aspect-[4/3] rounded-lg overflow-hidden border border-line bg-cream p-2 flex flex-col gap-1.5">
      <div className="flex-1 flex gap-1.5">
        <div className="flex-1 flex flex-col justify-center gap-1">
          <div className="h-1.5 w-10 rounded-full bg-dark/60" />
          <div className="h-1.5 w-12 rounded-full bg-line" />
          <div className="h-2 w-8 rounded-full bg-terracotta/70 mt-1" />
        </div>
        <div className="flex-1 rounded bg-line/60" />
      </div>
      <div className="flex gap-1 h-5">
        <div className="flex-1 rounded bg-line/40" />
        <div className="flex-1 rounded bg-line/40" />
      </div>
      <div className="flex gap-1 h-5">
        <div className="flex-1 rounded bg-line/50" />
        <div className="flex-1 rounded bg-line/50" />
        <div className="flex-1 rounded bg-line/50" />
        <div className="flex-1 rounded bg-line/50" />
      </div>
    </div>
  );
}
