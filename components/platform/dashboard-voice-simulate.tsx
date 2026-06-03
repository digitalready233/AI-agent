import { listAgents } from "@/lib/platform/data";
import { VoiceSimulatePanel } from "@/components/platform/voice-simulate-panel";

export async function DashboardVoiceSimulate({ orgId }: { orgId: string }) {
  const agents = await listAgents(orgId);
  const enabled = agents.filter((a) => a.enabled);
  if (enabled.length === 0) return null;

  return (
    <VoiceSimulatePanel
      agents={enabled.map((a) => ({ id: a.id, name: a.nickname ?? a.name }))}
    />
  );
}
