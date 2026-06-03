import { z } from "zod";
import { requireSession } from "@/lib/platform/auth";
import { resolveCampaignAudience } from "@/lib/platform/campaign-audience";
import { replaceCampaignSteps } from "@/lib/platform/campaign-automation-data";
import { bootstrapCampaignLeadSchedule } from "@/lib/platform/campaign-runner";
import type { CampaignStep, DelayUnit } from "@/lib/platform/campaign-types";
import {
  countLeadsByCampaign,
  deleteCampaign,
  getCampaign,
  listAgents,
  listCampaigns,
  saveCampaign,
  setCampaignLeads,
} from "@/lib/platform/data";
import { parseFollowUpRules } from "@/lib/platform/campaign-types";
import type { Campaign, CampaignStatus } from "@/lib/platform/types";

const followUpRulesSchema = z.object({
  message_template: z.string().optional(),
  delay_hours: z.number().min(0).optional(),
  max_attempts: z.number().min(1).max(20).optional(),
  channel: z.enum(["whatsapp", "email", "sms", "both", "auto"]).optional(),
  whatsapp_template_id: z.string().uuid().optional(),
  whatsapp_template_parameters: z.array(z.string()).optional(),
  sent_count: z.number().optional(),
  replied_count: z.number().optional(),
});

const stepSchema = z.object({
  step_order: z.number().int().min(0),
  delay_amount: z.number().int().min(0),
  delay_unit: z.enum(["minutes", "hours", "days"]),
  message_template_id: z.string().uuid().optional().nullable(),
  message_body: z.string().optional().nullable(),
  action_after_send: z.string().optional().nullable(),
  stop_on_reply: z.boolean().optional(),
  mark_no_response: z.boolean().optional(),
});

const campaignSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  agent_id: z.string().optional().nullable(),
  campaign_type: z.string().optional().nullable(),
  status: z
    .enum(["draft", "scheduled", "live", "paused", "completed", "failed"])
    .optional(),
  scheduled_at: z.string().optional().nullable(),
  follow_up_rules: followUpRulesSchema.optional(),
  channel: z.enum(["whatsapp", "email", "voice", "voice_future"]).optional(),
  audience_filters: z.record(z.unknown()).optional(),
  stop_conditions: z.record(z.unknown()).optional(),
  message_template_id: z.string().uuid().optional().nullable(),
  use_sequence: z.boolean().optional(),
  voice_settings: z.record(z.unknown()).optional(),
  lead_ids: z.array(z.string()).optional(),
  steps: z.array(stepSchema).optional(),
});

export async function GET() {
  const { organization } = await requireSession();
  const [campaigns, leadCounts] = await Promise.all([
    listCampaigns(organization.id),
    countLeadsByCampaign(organization.id),
  ]);
  const enriched = campaigns.map((c) => ({
    ...c,
    lead_count: leadCounts[c.id] ?? 0,
  }));
  return Response.json({ campaigns: enriched });
}

async function persistSteps(
  campaignId: string,
  organizationId: string,
  steps: z.infer<typeof stepSchema>[] | undefined
) {
  if (!steps?.length) return;
  const rows: Omit<CampaignStep, "created_at" | "updated_at">[] = steps.map((s) => ({
    id: crypto.randomUUID(),
    campaign_id: campaignId,
    organization_id: organizationId,
    step_order: s.step_order,
    delay_amount: s.delay_amount,
    delay_unit: s.delay_unit as DelayUnit,
    message_template_id: s.message_template_id ?? null,
    message_body: s.message_body ?? null,
    action_after_send: s.action_after_send ?? "wait_for_reply",
    stop_on_reply: s.stop_on_reply ?? true,
    mark_no_response: s.mark_no_response ?? false,
  }));
  await replaceCampaignSteps(campaignId, organizationId, rows);
}

async function syncAudience(
  campaign: Campaign,
  leadIds: string[] | undefined,
  audienceFilters: Record<string, unknown> | undefined
) {
  if (leadIds?.length) {
    await setCampaignLeads(campaign.id, campaign.organization_id, leadIds);
    return;
  }
  if (audienceFilters && Object.keys(audienceFilters).length > 0) {
    const leads = await resolveCampaignAudience(
      campaign.organization_id,
      audienceFilters,
      { channel: campaign.channel }
    );
    await setCampaignLeads(
      campaign.id,
      campaign.organization_id,
      leads.map((l) => l.id)
    );
  }
}

export async function POST(req: Request) {
  const { organization } = await requireSession();
  const parsed = campaignSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;
  if (d.agent_id) {
    const agents = await listAgents(organization.id);
    if (!agents.some((a) => a.id === d.agent_id)) {
      return Response.json({ error: "Agent not found" }, { status: 400 });
    }
  }

  const now = new Date().toISOString();
  const campaign: Campaign = {
    id: crypto.randomUUID(),
    organization_id: organization.id,
    agent_id: d.agent_id ?? null,
    name: d.name,
    campaign_type: d.campaign_type ?? "new_lead_follow_up",
    status: (d.status as CampaignStatus) ?? "draft",
    scheduled_at: d.scheduled_at ?? null,
    follow_up_rules: d.follow_up_rules ?? {},
    channel: d.channel ?? "whatsapp",
    audience_filters: d.audience_filters ?? {},
    stop_conditions: d.stop_conditions ?? {},
    message_template_id: d.message_template_id ?? null,
    use_sequence: d.use_sequence ?? Boolean(d.steps?.length),
    voice_settings: d.voice_settings ?? {},
    created_at: now,
    updated_at: now,
  };

  const saved = await saveCampaign(campaign);
  await syncAudience(saved, d.lead_ids, d.audience_filters);
  if (d.steps?.length) {
    await persistSteps(saved.id, organization.id, d.steps);
  }
  if (saved.status === "live" || saved.status === "scheduled") {
    await bootstrapCampaignLeadSchedule(saved.id, organization.id);
  }

  return Response.json({ campaign: saved }, { status: 201 });
}

export async function PUT(req: Request) {
  const { organization } = await requireSession();
  const parsed = campaignSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;
  if (!d.id) {
    return Response.json({ error: "Campaign id required" }, { status: 400 });
  }

  const existing = await getCampaign(d.id);
  if (!existing || existing.organization_id !== organization.id) {
    return Response.json({ error: "Campaign not found" }, { status: 404 });
  }

  const campaign: Campaign = {
    ...existing,
    name: d.name,
    agent_id: d.agent_id ?? existing.agent_id,
    campaign_type: d.campaign_type ?? existing.campaign_type,
    status: (d.status as CampaignStatus) ?? existing.status,
    scheduled_at: d.scheduled_at !== undefined ? d.scheduled_at : existing.scheduled_at,
    follow_up_rules:
      d.follow_up_rules !== undefined
        ? { ...parseFollowUpRules(existing.follow_up_rules), ...d.follow_up_rules }
        : existing.follow_up_rules,
    channel: d.channel ?? existing.channel,
    audience_filters:
      d.audience_filters !== undefined ? d.audience_filters : existing.audience_filters,
    stop_conditions:
      d.stop_conditions !== undefined ? d.stop_conditions : existing.stop_conditions,
    message_template_id:
      d.message_template_id !== undefined
        ? d.message_template_id
        : existing.message_template_id,
    use_sequence:
      d.use_sequence !== undefined
        ? d.use_sequence
        : existing.use_sequence ?? Boolean(d.steps?.length),
    voice_settings:
      d.voice_settings !== undefined ? d.voice_settings : existing.voice_settings,
    updated_at: new Date().toISOString(),
  };

  const saved = await saveCampaign(campaign);
  if (d.lead_ids !== undefined || d.audience_filters !== undefined) {
    await syncAudience(saved, d.lead_ids, d.audience_filters ?? campaign.audience_filters);
  }
  if (d.steps !== undefined) {
    await persistSteps(saved.id, organization.id, d.steps);
  }
  if (saved.status === "live") {
    await bootstrapCampaignLeadSchedule(saved.id, organization.id);
  }

  return Response.json({ campaign: saved });
}

export async function DELETE(req: Request) {
  const { organization } = await requireSession();
  const id = new URL(req.url).searchParams.get("id")?.trim();
  if (!id) {
    return Response.json({ error: "id required" }, { status: 400 });
  }

  const existing = await getCampaign(id);
  if (!existing || existing.organization_id !== organization.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await deleteCampaign(id, organization.id);
  return Response.json({ ok: true });
}
