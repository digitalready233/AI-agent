import type { PlatformChatResponseBody } from "@/lib/platform/chat/build-platform-chat-response";

export const UI_PIPELINE_STAGES = [
  { key: "discovery", label: "Discovery" },
  { key: "stack", label: "Stack" },
  { key: "team", label: "Team" },
  { key: "budget", label: "Budget" },
  { key: "close", label: "Close" },
  { key: "handoff", label: "Handoff" },
] as const;

export type UiPipelineStage = (typeof UI_PIPELINE_STAGES)[number]["key"];

export function resolveUiPipelineStage(params: {
  readybotPipelineStep?: PlatformChatResponseBody["readybotPipelineStep"];
  conversationStage?: string;
  handoffActive?: boolean;
}): UiPipelineStage {
  if (params.handoffActive) return "handoff";

  const step = params.readybotPipelineStep;
  if (step === "stack") return "stack";
  if (step === "team") return "team";
  if (step === "budget_timing") return "budget";
  if (step === "close") return "close";

  if (
    step === "discovery" ||
    step === "onboarding" ||
    params.conversationStage === "greeting" ||
    params.conversationStage === "discovery"
  ) {
    return "discovery";
  }

  if (params.conversationStage === "qualification") return "stack";
  if (params.conversationStage === "booking") return "close";
  if (params.conversationStage === "handoff") return "handoff";

  return "discovery";
}

export function uiStageIndex(stage: UiPipelineStage): number {
  return UI_PIPELINE_STAGES.findIndex((s) => s.key === stage);
}
