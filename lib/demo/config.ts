/**
 * Stage 2: AI demo workflow is ON by default.
 * Set DEMO_ROOM_STAGE1_PLACEHOLDER=true to restore placeholder-only chat/summary.
 */
export function isDemoRoomAiEnabled(): boolean {
  if (process.env.DEMO_ROOM_STAGE1_PLACEHOLDER === "true") return false;
  if (process.env.DEMO_ROOM_AI_ENABLED === "false") return false;
  return true;
}

export const DEMO_STAGE1_PLACEHOLDER_REPLY =
  "Thanks for sharing that. I'll guide you through the demo and help recommend the best next step.";
