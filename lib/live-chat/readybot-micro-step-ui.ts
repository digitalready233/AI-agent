import type { ReadybotMicroStep } from "@/lib/platform/workflow/readybot-micro-steps";

export type MicroStepUiMeta = {
  stage: "Discovery" | "Stack";
  stepIndex: number;
  stepTotal: number;
  badge: string;
  topic: string;
};

const DISCOVERY_FLOW: {
  id: NonNullable<ReadybotMicroStep>;
  shortLabel: string;
  topic: string;
}[] = [
  {
    id: "goal_clarify",
    shortLabel: "Goal focus",
    topic: "Followers, engagement, or conversions?",
  },
  {
    id: "milestone",
    shortLabel: "Milestone",
    topic: "Biggest win in the next 6 months",
  },
];

const STACK_FLOW: {
  id: NonNullable<ReadybotMicroStep>;
  shortLabel: string;
  topic: string;
}[] = [
  { id: "stack_ads", shortLabel: "Paid ads", topic: "Ads & lead generation stack" },
  { id: "stack_social", shortLabel: "Social", topic: "Social media & branding stack" },
  { id: "stack_web_ops", shortLabel: "Web/Ops", topic: "Web, e-commerce & automation stack" },
];

export function readybotMicroStepUi(step: ReadybotMicroStep): MicroStepUiMeta | null {
  if (!step) return null;

  const discoveryIdx = DISCOVERY_FLOW.findIndex((s) => s.id === step);
  if (discoveryIdx >= 0) {
    const item = DISCOVERY_FLOW[discoveryIdx];
    return {
      stage: "Discovery",
      stepIndex: discoveryIdx + 1,
      stepTotal: DISCOVERY_FLOW.length,
      badge: `Discovery · ${discoveryIdx + 1} of ${DISCOVERY_FLOW.length}`,
      topic: item.topic,
    };
  }

  const stackIdx = STACK_FLOW.findIndex((s) => s.id === step);
  if (stackIdx >= 0) {
    const item = STACK_FLOW[stackIdx];
    return {
      stage: "Stack",
      stepIndex: stackIdx + 1,
      stepTotal: STACK_FLOW.length,
      badge: `Stack · ${item.shortLabel}`,
      topic: item.topic,
    };
  }

  return null;
}

export function discoveryMicroStepFlow() {
  return DISCOVERY_FLOW;
}

export function stackMicroStepFlow() {
  return STACK_FLOW;
}
