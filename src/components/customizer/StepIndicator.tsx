"use client";

import { SegmentedControl } from "./SegmentedControl";

// FLOW-01's step indicator — an iOS pill segmented control per the Product
// Customizer redesign (design_handoff_product_customizer/README.md), with
// completed steps still clickable to go back. The primary "Next" button
// lives with each step's own content, not here.
//
// Options and Review were merged into one "Confirmación" step per request:
// quantity, technique summary and the pre-order checklist together, shown
// alongside a read-only preview instead of the live editable canvas — no
// more back-and-forth between a pricing screen and a review screen.
export type FlowStep = "design" | "confirmation";

export const FLOW_STEPS: { id: FlowStep; label: string }[] = [
  { id: "design", label: "Design" },
  { id: "confirmation", label: "Confirmation" },
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
    <nav aria-label="Purchase steps" className="hidden md:flex items-center">
      <SegmentedControl
        height={28}
        fitContent
        value={step}
        onChange={(id) => {
          const clickable = id === step || completedSteps.has(id);
          if (clickable) onSelectStep(id);
        }}
        options={FLOW_STEPS.map((s) => ({ id: s.id, label: s.label, ariaLabel: s.label }))}
      />
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
