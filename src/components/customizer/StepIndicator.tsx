"use client";

// FLOW-01's step indicator: "1 Design — 2 Options — 3 Review" in the top
// bar, with completed steps checked and clickable to go back. The primary
// "Next" button lives with each step's own content, not here.
export type FlowStep = "design" | "options" | "review";

export const FLOW_STEPS: { id: FlowStep; label: string }[] = [
  { id: "design", label: "Design" },
  { id: "options", label: "Options" },
  { id: "review", label: "Review" },
];

export function StepIndicator({
  step,
  completedSteps,
  onSelectStep,
}: {
  step: FlowStep;
  completedSteps: Set<FlowStep>;
  onSelectStep: (step: FlowStep) => void;
}) {
  return (
    <nav aria-label="Purchase steps" className="hidden md:flex items-center gap-1.5">
      {FLOW_STEPS.map((s, i) => {
        const isActive = s.id === step;
        const isDone = completedSteps.has(s.id) && !isActive;
        const clickable = isDone || isActive;
        return (
          <div key={s.id} className="flex items-center gap-1.5">
            {i > 0 && <span className="w-5 h-px bg-line" aria-hidden="true" />}
            <button
              type="button"
              onClick={() => clickable && onSelectStep(s.id)}
              disabled={!clickable}
              aria-current={isActive ? "step" : undefined}
              className={`flex items-center gap-1.5 text-sm h-11 px-3 rounded-full ${
                isActive ? "font-medium text-dark bg-cream" : isDone ? "text-terracotta-dark" : "text-muted"
              } ${!clickable ? "cursor-default" : ""}`}
            >
              {isDone ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              ) : (
                <span
                  className={`h-4 w-4 shrink-0 rounded-full border text-[10px] flex items-center justify-center ${
                    isActive ? "border-dark" : "border-muted"
                  }`}
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
              )}
              {s.label}
            </button>
          </div>
        );
      })}
    </nav>
  );
}

export function MobileStepIndicator({ step }: { step: FlowStep }) {
  const i = FLOW_STEPS.findIndex((s) => s.id === step);
  return (
    <span className="md:hidden text-xs text-muted font-medium">
      Step {i + 1} of {FLOW_STEPS.length} · {FLOW_STEPS[i].label}
    </span>
  );
}
