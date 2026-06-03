import { headers } from "next/headers";
import { z } from "zod";
import { requireSession } from "@/lib/platform/auth";
import { requirePermission } from "@/lib/platform/rbac";
import { getAgent, getLead } from "@/lib/platform/data";
import { listDemoSessions, saveDemoSession } from "@/lib/demo/demo-data";
import type { DemoSession } from "@/lib/demo/types";
import { multiAgentCreateFieldsSchema } from "@/lib/demo/multi-agent/create-session-schema";
import { applyMultiAgentFieldsToSession } from "@/lib/demo/multi-agent/apply-session-team";

const createSchema = z
  .object({
    agent_id: z.string().uuid(),
    lead_id: z.string().uuid().optional(),
    title: z.string().min(1).max(200).optional(),
    demo_type: z.string().max(64).optional(),
    scheduled_at: z.string().datetime().optional(),
    admin_notes: z.string().max(2000).optional(),
  })
  .merge(multiAgentCreateFieldsSchema);

export async function GET(req: Request) {
  const session = await requireSession();
  requirePermission(session, "conversations.view");

  const url = new URL(req.url);
  const filters = {
    status: url.searchParams.get("status") ?? undefined,
    agentId: url.searchParams.get("agent_id") ?? undefined,
    leadCategory: url.searchParams.get("lead_category") ?? undefined,
    handoffRequired: url.searchParams.get("handoff_required") === "true",
    bookingRecommended: url.searchParams.get("booking_recommended") === "true",
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  };

  const rows = await listDemoSessions(session.organization.id, filters);
  const leads = await Promise.all(
    rows.map(async (r) => (r.lead_id ? getLead(r.lead_id) : null))
  );
  const agents = await Promise.all(
    rows.map(async (r) => (r.agent_id ? getAgent(r.agent_id) : null))
  );

  return Response.json({
    sessions: rows.map((r, i) => ({
      ...r,
      lead_name: leads[i]?.full_name ?? null,
      agent_name: agents[i]?.name ?? null,
    })),
  });
}

export async function POST(req: Request) {
  const session = await requireSession();
  requirePermission(session, "conversations.manage");

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const agent = await getAgent(parsed.data.agent_id);
  if (!agent || agent.organization_id !== session.organization.id) {
    return Response.json({ error: "Agent not found" }, { status: 404 });
  }

  const { ensureDemoExperienceForAgent } = await import("@/lib/demo/ensure-demo-setup");
  await ensureDemoExperienceForAgent({
    organizationId: session.organization.id,
    agentId: agent.id,
  });

  if (parsed.data.lead_id) {
    const lead = await getLead(parsed.data.lead_id);
    if (!lead || lead.organization_id !== session.organization.id) {
      return Response.json({ error: "Lead not found" }, { status: 404 });
    }
  }

  if (parsed.data.lead_id) {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    const proto = h.get("x-forwarded-proto") ?? "http";
    const siteOrigin = host ? `${proto}://${host}` : undefined;
    const { createDemoSessionForLead } = await import("@/lib/demo/create-demo-for-lead");
    const { multi_agent_enabled, multi_agent_assignment_mode, ...rest } = parsed.data;
    const result = await createDemoSessionForLead({
      organizationId: session.organization.id,
      leadId: parsed.data.lead_id,
      agentId: parsed.data.agent_id,
      title: parsed.data.title,
      siteOrigin,
      multiAgent:
        multi_agent_enabled !== undefined
          ? {
              multi_agent_enabled,
              multi_agent_assignment_mode,
              primary_presenter_agent_id: rest.primary_presenter_agent_id,
              qualification_agent_id: rest.qualification_agent_id,
              objection_agent_id: rest.objection_agent_id,
              booking_agent_id: rest.booking_agent_id,
              crm_summary_agent_id: rest.crm_summary_agent_id,
              handoff_agent_id: rest.handoff_agent_id,
              follow_up_agent_id: rest.follow_up_agent_id,
            }
          : undefined,
    });
    return Response.json({
      session: result.session,
      room_url: result.roomUrl,
      share_url: result.absoluteUrl ?? result.roomUrl,
    });
  }

  const now = new Date().toISOString();
  const row: DemoSession = {
    id: crypto.randomUUID(),
    organization_id: session.organization.id,
    agent_id: parsed.data.agent_id,
    lead_id: null,
    conversation_id: null,
    booking_id: null,
    title: parsed.data.title ?? "Product demo",
    demo_type: parsed.data.demo_type ?? "product",
    status: "scheduled",
    current_demo_stage: "welcome",
    entry_mode: "scheduled",
    demo_path_id: null,
    current_demo_asset_id: null,
    objections: [],
    qualification_progress: { need: false, budget: false, authority: false, timeline: false },
    started_at: null,
    ended_at: null,
    duration_seconds: null,
    summary: null,
    transcript: null,
    detected_intent: null,
    lead_score: null,
    lead_category: null,
    handoff_required: false,
    booking_recommended: false,
    recommended_next_action: null,
    recording_url: null,
    scheduled_at: parsed.data.scheduled_at ?? null,
    admin_notes: parsed.data.admin_notes ?? null,
    metadata: {
      video_providers: ["livekit", "daily", "zoom", "agora"],
      stage: "browser_demo_room",
    },
    created_at: now,
    updated_at: now,
  };
  row.metadata = {
    ...row.metadata,
    room_url: `/demo-room/${row.id}`,
  };

  const sessionRow = applyMultiAgentFieldsToSession(row, parsed.data);
  let saved = await saveDemoSession(sessionRow);
  const { getMultiAgentDemoSettings } = await import("@/lib/demo/multi-agent/settings");
  const { setupMultiAgentDemoSession } = await import(
    "@/lib/demo/multi-agent/session-setup"
  );
  const multiSettings = await getMultiAgentDemoSettings(session.organization.id);
  const runMultiAgent =
    saved.multi_agent_enabled === true ||
    (saved.multi_agent_enabled !== false && multiSettings.enabled);
  if (runMultiAgent) {
    saved = await setupMultiAgentDemoSession(saved, {
      enabled: saved.multi_agent_enabled ?? multiSettings.enabled,
      mode: saved.multi_agent_assignment_mode,
    });
  }
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  const roomPath = `/demo-room/${saved.id}`;
  const shareUrl = host ? `${proto}://${host}${roomPath}` : roomPath;

  return Response.json({
    session: saved,
    room_url: roomPath,
    share_url: shareUrl,
  });
}
