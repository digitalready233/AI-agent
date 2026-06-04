import { notFound } from "next/navigation";
import { requireSession } from "@/lib/platform/auth";
import {
  getConversation,
  getLead,
  listMessages,
  listProfiles,
} from "@/lib/platform/data";
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

  const [messages, team, lead] = await Promise.all([
    listMessages(id),
    listProfiles(session.organization.id),
    conversation.lead_id
      ? getLead(conversation.lead_id)
      : Promise.resolve(null),
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

      {(lead ||
        conversation.customer_email ||
        conversation.customer_phone ||
        conversation.customer_name) && (
        <div className="mb-4 rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-sm text-slate-200">
          <p className="font-medium text-amber-100/90">Visitor contact</p>
          <ul className="mt-2 space-y-1 text-slate-300">
            {(lead?.full_name ?? conversation.customer_name) && (
              <li>
                Name: {lead?.full_name ?? conversation.customer_name}
              </li>
            )}
            {lead?.business_name && <li>Business: {lead.business_name}</li>}
            {(lead?.email ?? conversation.customer_email) && (
              <li>
                Email:{" "}
                <a
                  className="text-cyan-400 hover:underline"
                  href={`mailto:${lead?.email ?? conversation.customer_email}`}
                >
                  {lead?.email ?? conversation.customer_email}
                </a>
              </li>
            )}
            {(lead?.phone ?? conversation.customer_phone) && (
              <li>
                Phone:{" "}
                <a
                  className="text-cyan-400 hover:underline"
                  href={`tel:${lead?.phone ?? conversation.customer_phone}`}
                >
                  {lead?.phone ?? conversation.customer_phone}
                </a>
              </li>
            )}
          </ul>
        </div>
      )}

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
