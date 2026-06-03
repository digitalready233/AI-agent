import { getAgent, getLead } from "@/lib/platform/data";
import { getDemoSession } from "./demo-data";
import { runPostDemoCrmAndFollowUp } from "./demo-close-pipeline";
import type { DemoSession } from "./types";

/** CRM + follow-up only (session must already have summary/transcript from close pipeline). */
export async function runPostDemoAutomation(session: DemoSession): Promise<DemoSession> {
  if (session.post_demo_automation_at) return session;
  const lead = session.lead_id ? await getLead(session.lead_id) : null;
  const agent = session.agent_id ? await getAgent(session.agent_id) : null;
  return runPostDemoCrmAndFollowUp(session, { lead, agent });
}
