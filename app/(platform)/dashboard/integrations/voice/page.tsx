import { requireSession } from "@/lib/platform/auth";
import { listAgents } from "@/lib/platform/data";
import { requirePermission } from "@/lib/platform/rbac";
import { PageHeader } from "@/components/platform/page-header";
import { VoiceSettingsPanel } from "@/components/platform/voice-settings";

export default async function VoiceIntegrationPage() {
  const session = await requireSession();
  requirePermission(session, "integrations.manage");

  const agents = await listAgents(session.organization.id);

  return (
    <div className="platform-page">
      <PageHeader
        title="Voice calls (Twilio)"
        description="Inbound AI voice with Twilio Media Streams and OpenAI Realtime. Credentials stay on the server."
      />
      <VoiceSettingsPanel
        agents={agents.map((a) => ({ id: a.id, name: a.nickname ?? a.name }))}
      />
    </div>
  );
}
