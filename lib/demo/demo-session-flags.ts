import type { DemoSession } from "./types";

/** Pure session flags — safe to import from client components (no server/voice deps). */
export function isDemoAiPaused(session: DemoSession): boolean {
  if (session.ai_paused === true) return true;
  if (session.metadata?.ai_paused === true) return true;
  return false;
}
