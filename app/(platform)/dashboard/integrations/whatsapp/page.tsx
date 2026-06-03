import { requireSession } from "@/lib/platform/auth";
import { listAgents } from "@/lib/platform/data";
import { requirePermission } from "@/lib/platform/rbac";
import { PageHeader } from "@/components/platform/page-header";
import { WhatsAppSettingsPanel } from "@/components/platform/whatsapp-settings";

export default async function WhatsAppIntegrationPage() {
  const session = await requireSession();
  requirePermission(session, "integrations.manage");

  const agents = await listAgents(session.organization.id);

  return (
    <div className="platform-page">
      <PageHeader
        title="WhatsApp Cloud API"
        description="Connect Meta WhatsApp Business, receive inbound messages, and reply with your AI sales workflow."
      />
      <WhatsAppSettingsPanel
        agents={agents.map((a) => ({ id: a.id, name: a.nickname ?? a.name }))}
      />
    </div>
  );
}
