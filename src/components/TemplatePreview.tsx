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
