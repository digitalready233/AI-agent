import { notFound } from "next/navigation";
import { requireSession } from "@/lib/platform/auth";
import { getConversation, listMessages, listProfiles } from "@/lib/platform/data";
import { can } from "@/lib/platform/rbac";
import { PageHeader } from "@/components/platform/page-header";
import { StaffConversationInbox } from "@/components/platform/staff-conversation-inbox";
import { Badge } from "@/components/ui/badge";

export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const conversation = await getConversation(id);

  if (!conversation || conversation.organization_id !== session.organization.id) {
    notFound();
  }

  const [messages, team] = await Promise.all([
    listMessages(id),
    listProfiles(session.organization.id),
  ]);

  const canManage = can(session.profile.role, "conversations.manage");

  return (
    <div className="platform-page">
      <PageHeader
        title={conversation.customer_name ?? "Conversation"}
        description={[
          conversation.channel === "whatsapp" ? "WhatsApp" : conversation.channel,
          conversation.customer_phone,
          conversation.status.replace(/_/g, " "),
        ]
          .filter(Boolean)
          .join(" · ")}
        backHref="/dashboard/conversations"
        backLabel="Inbox"
        actions={
          <Badge
            variant={
              conversation.status === "human_needed"
                ? "warning"
                : conversation.status === "resolved"
                  ? "success"
                  : "secondary"
            }
          >
            {conversation.status.replace(/_/g, " ")}
          </Badge>
        }
      />

      <StaffConversationInbox
        conversation={conversation}
        initialMessages={messages}
        team={team}
        currentProfileId={session.profile.id}
        canManage={canManage}
      />
    </div>
  );
}
