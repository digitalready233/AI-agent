import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { requireSession } from "@/lib/platform/auth";
import {
  getLastMessagePreviews,
  listConversations,
  listLeads,
  listProfiles,
} from "@/lib/platform/data";
import { ConversationChannelBadge } from "@/components/platform/conversation-channel-badge";
import { requirePermission } from "@/lib/platform/rbac";
import { CONVERSATION_STAGE_LABELS } from "@/lib/platform/sales-ops";
import { WORKFLOW_STAGES } from "@/lib/platform/workflow/schemas";
import { PageHeader } from "@/components/platform/page-header";
import { EmptyState } from "@/components/platform/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ConversationStatus } from "@/lib/platform/types";
import type { WorkflowStage } from "@/lib/platform/workflow/schemas";

const statusVariant = (status: string) => {
  if (status === "human_needed") return "warning" as const;
  if (status === "resolved" || status === "closed") return "success" as const;
  return "secondary" as const;
};

const FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "human_needed", label: "Human needed" },
  { value: "assigned", label: "Assigned" },
  { value: "ai_handling", label: "AI handling" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const STAGE_FILTER_OPTIONS = [
  { value: "all", label: "All stages" },
  ...WORKFLOW_STAGES.map((s) => ({
    value: s,
    label: CONVERSATION_STAGE_LABELS[s],
  })),
];

const CHANNEL_FILTER_OPTIONS = [
  { value: "all", label: "All channels" },
  { value: "website", label: "Website" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "live_agent", label: "Live agent" },
  { value: "email", label: "Email" },
];

type SearchParams = Promise<{
  status?: string;
  stage?: string;
  mine?: string;
  channel?: string;
}>;

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireSession();
  requirePermission(session, "conversations.view");

  const params = await searchParams;
  const statusParam = params.status?.trim();
  const stageParam = params.stage?.trim();
  const channelParam = params.channel?.trim();
  const mineOnly = params.mine === "1";

  const [all, team, leads] = await Promise.all([
    listConversations(session.organization.id),
    listProfiles(session.organization.id),
    listLeads(session.organization.id),
  ]);

  const profileById = new Map(team.map((p) => [p.id, p.full_name]));
  const leadById = new Map(leads.map((l) => [l.id, l]));
  const lastMessages = await getLastMessagePreviews(all.map((c) => c.id));

  let conversations = statusParam ? all.filter((c) => c.status === statusParam) : all;
  if (stageParam && stageParam !== "all") {
    conversations = conversations.filter((c) => c.conversation_stage === stageParam);
  }
  if (mineOnly) {
    conversations = conversations.filter((c) => c.assigned_to === session.profile.id);
  }
  if (channelParam && channelParam !== "all") {
    conversations = conversations.filter((c) => c.channel === channelParam);
  }

  const filterLabel = mineOnly
    ? "Assigned to me"
    : statusParam === "human_needed"
      ? "Human handoff inbox"
      : stageParam && stageParam !== "all"
        ? CONVERSATION_STAGE_LABELS[stageParam as WorkflowStage] ?? stageParam
        : statusParam
          ? statusParam.replace(/_/g, " ")
          : null;

  function buildHref(next: {
    status?: string | null;
    stage?: string | null;
    channel?: string | null;
    mine?: boolean;
  }) {
    const q = new URLSearchParams();
    const status =
      next.status !== undefined
        ? next.status
        : mineOnly
          ? undefined
          : statusParam;
    const stage =
      next.stage !== undefined ? next.stage : stageParam;
    const channel =
      next.channel !== undefined ? next.channel : channelParam;
    const mine = next.mine ?? mineOnly;
    if (status && status !== "all") q.set("status", status);
    if (stage && stage !== "all") q.set("stage", stage);
    if (channel && channel !== "all") q.set("channel", channel);
    if (mine) q.set("mine", "1");
    const qs = q.toString();
    return qs ? `/dashboard/conversations?${qs}` : "/dashboard/conversations";
  }

  return (
    <div className="platform-page">
      <PageHeader
        title={filterLabel ? `Sales conversations — ${filterLabel}` : "Sales conversations"}
        description="Website and WhatsApp chats — intent, stage, qualification, and staff handoff."
        actions={
          statusParam || stageParam || channelParam || mineOnly ? (
            <Button variant="outline" size="sm" className="rounded-xl" asChild>
              <Link href="/dashboard/conversations">Clear filters</Link>
            </Button>
          ) : undefined
        }
      />

      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-slate-500 self-center mr-1">Channel</span>
          {CHANNEL_FILTER_OPTIONS.map((opt) => {
            const active =
              opt.value === "all" ? !channelParam : channelParam === opt.value;
            const href =
              opt.value === "all"
                ? buildHref({ channel: null })
                : buildHref({ channel: opt.value });
            return (
              <Link
                key={opt.value}
                href={href}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/30"
                    : "bg-slate-800/50 text-slate-400 hover:text-slate-200"
                }`}
              >
                {opt.label}
              </Link>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-slate-500 self-center mr-1">Status</span>
          {FILTER_OPTIONS.map((opt) => {
            const active =
              opt.value === "all" ? !statusParam && !mineOnly : statusParam === opt.value;
            const href =
              opt.value === "all"
                ? buildHref({ status: null, mine: false })
                : buildHref({ status: opt.value });
            return (
              <Link
                key={opt.value}
                href={href}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/30"
                    : "bg-slate-800/50 text-slate-400 hover:text-slate-200"
                }`}
              >
                {opt.label}
              </Link>
            );
          })}
          <Link
            href={buildHref({ mine: !mineOnly })}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              mineOnly
                ? "bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/30"
                : "bg-slate-800/50 text-slate-400 hover:text-slate-200"
            }`}
          >
            Assigned to me
          </Link>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-slate-500 self-center mr-1">Stage</span>
          {STAGE_FILTER_OPTIONS.map((opt) => {
            const active =
              opt.value === "all" ? !stageParam : stageParam === opt.value;
            const href =
              opt.value === "all"
                ? buildHref({ stage: null })
                : buildHref({ stage: opt.value });
            return (
              <Link
                key={opt.value}
                href={href}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "bg-violet-500/15 text-violet-200 ring-1 ring-violet-500/30"
                    : "bg-slate-800/50 text-slate-400 hover:text-slate-200"
                }`}
              >
                {opt.label}
              </Link>
            );
          })}
        </div>
      </div>

      {conversations.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title={
            statusParam || stageParam || mineOnly
              ? "No conversations match this filter"
              : "Inbox is empty"
          }
          description={
            statusParam || stageParam || mineOnly
              ? "Try another filter or clear filters to see all conversations."
              : "Customer conversations from your website, WhatsApp, and other channels will appear here."
          }
        />
      ) : (
        <div className="space-y-2">
          {conversations.map((c) => {
            const lead = c.lead_id ? leadById.get(c.lead_id) : undefined;
            const last = lastMessages.get(c.id);
            return (
            <Link
              key={c.id}
              href={`/dashboard/conversations/${c.id}`}
              className="platform-inbox-item"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-white truncate">
                    {c.customer_name ?? "Visitor"}
                  </p>
                  <ConversationChannelBadge channel={c.channel} />
                  {c.status === "human_needed" && (
                    <Badge variant="warning" className="text-[10px]">
                      Handoff
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {c.customer_phone ? (
                    <>
                      <span className="text-slate-400">{c.customer_phone}</span>
                      {" · "}
                    </>
                  ) : null}
                  {c.detected_intent ?? "general"}
                  {lead?.lead_status ? ` · Lead: ${lead.lead_status}` : ""}
                  {c.conversation_stage
                    ? ` · ${CONVERSATION_STAGE_LABELS[c.conversation_stage as WorkflowStage] ?? c.conversation_stage}`
                    : ""}
                  {c.assigned_to && profileById.get(c.assigned_to)
                    ? ` · ${profileById.get(c.assigned_to)}`
                    : ""}{" "}
                  · {new Date(c.updated_at).toLocaleString()}
                </p>
                {last?.content ? (
                  <p className="text-sm text-slate-300 mt-1 line-clamp-1">{last.content}</p>
                ) : c.summary ? (
                  <p className="text-sm text-slate-400 mt-1 line-clamp-1">{c.summary}</p>
                ) : null}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <Badge variant={statusVariant(c.status)}>
                  {c.status.replace(/_/g, " ")}
                </Badge>
                {lead?.lead_category && (
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {lead.lead_category}
                  </Badge>
                )}
                {c.conversation_stage && (
                  <Badge variant="outline" className="text-[10px]">
                    {CONVERSATION_STAGE_LABELS[c.conversation_stage as WorkflowStage] ??
                      c.conversation_stage}
                  </Badge>
                )}
              </div>
            </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
