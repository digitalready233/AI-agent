import { z } from "zod";
import { requireSession } from "@/lib/platform/auth";
import { requirePermission } from "@/lib/platform/rbac";
import { getAgent } from "@/lib/platform/data";
import {
  getDemoSession,
  listDemoMessages,
  listDemoTranscripts,
  saveDemoSession,
} from "@/lib/demo/demo-data";
import { endDemoSession } from "@/lib/demo/end-demo-session";
import { requestDemoHumanHandoff } from "@/lib/demo/request-handoff";
import {
  staffJoinLiveDemo,
  staffResumeAiDemo,
  staffTakeOverDemo,
} from "@/lib/demo/demo-live-handoff";
import { canJoinLiveDemo } from "@/lib/demo/demo-takeover-permissions";
import { canMarkDemoReviewed } from "@/lib/demo/demo-recording-permissions";
import { getLead, saveLead } from "@/lib/platform/data";
import type { LeadCategory } from "@/lib/platform/types";

const patchSchema = z.object({
  status: z
    .enum([
      "scheduled",
      "waiting",
      "in_progress",
      "completed",
      "missed",
      "cancelled",
      "human_taken_over",
    ])
    .optional(),
  handoff_required: z.boolean().optional(),
  request_handoff: z.boolean().optional(),
  title: z.string().min(1).max(200).optional(),
  end_demo: z.boolean().optional(),
  join_live: z.boolean().optional(),
  take_over: z.boolean().optional(),
  resume_ai: z.boolean().optional(),
  mark_qualified: z.boolean().optional(),
  mark_opportunity: z.boolean().optional(),
  agent_follow_up_notes: z.string().max(4000).optional(),
  manager_review: z
    .object({
      demo_quality_score: z.number().int().min(1).max(5).optional(),
      lead_quality_score: z.number().int().min(1).max(5).optional(),
      ai_performance_rating: z.number().int().min(1).max(5).optional(),
      human_takeover_rating: z.number().int().min(1).max(5).optional(),
      review_notes: z.string().max(4000).optional(),
      manager_notes: z.string().max(4000).optional(),
      review_status: z.enum(["not_reviewed", "reviewed", "needs_attention"]).optional(),
      mark_reviewed: z.boolean().optional(),
      mark_needs_attention: z.boolean().optional(),
    })
    .optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  requirePermission(session, "conversations.view");
  const { id } = await params;

  const demo = await getDemoSession(id);
  if (!demo || demo.organization_id !== session.organization.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const [messages, transcripts, lead, agent] = await Promise.all([
    listDemoMessages(id),
    listDemoTranscripts(id),
    demo.lead_id ? getLead(demo.lead_id) : null,
    demo.agent_id ? getAgent(demo.agent_id) : null,
  ]);

  return Response.json({ session: demo, messages, transcripts, lead, agent });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  requirePermission(session, "conversations.manage");
  const { id } = await params;

  const demo = await getDemoSession(id);
  if (!demo || demo.organization_id !== session.organization.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.end_demo) {
    const result = await endDemoSession({ demoSessionId: id });
    const updated = await getDemoSession(id);
    return Response.json({ session: updated, summary: result.summary });
  }

  if (parsed.data.request_handoff) {
    await requestDemoHumanHandoff({
      demoSessionId: id,
      requestedBy: "staff",
      notes: "Handoff requested by admin from dashboard",
    });
    const updated = await getDemoSession(id);
    return Response.json({ session: updated, handoff_required: true });
  }

  if (parsed.data.join_live) {
    if (!canJoinLiveDemo(session.profile.role, demo)) {
      return Response.json({ error: "Permission denied" }, { status: 403 });
    }
    const result = await staffJoinLiveDemo({ ctx: session, demoSessionId: id });
    return Response.json({ session: result.session });
  }

  if (parsed.data.take_over) {
    if (!canJoinLiveDemo(session.profile.role, demo)) {
      return Response.json({ error: "Permission denied" }, { status: 403 });
    }
    const updated = await staffTakeOverDemo({ ctx: session, demoSessionId: id });
    return Response.json({ session: updated });
  }

  if (parsed.data.resume_ai) {
    if (!canJoinLiveDemo(session.profile.role, demo)) {
      return Response.json({ error: "Permission denied" }, { status: 403 });
    }
    const updated = await staffResumeAiDemo({ ctx: session, demoSessionId: id });
    return Response.json({ session: updated });
  }

  if (parsed.data.mark_qualified && demo.lead_id) {
    const lead = await getLead(demo.lead_id);
    if (lead) {
      await saveLead({
        ...lead,
        lead_status: "qualified",
        lead_category: (lead.lead_category ??
          demo.lead_category ??
          "warm") as LeadCategory,
        updated_at: new Date().toISOString(),
      });
    }
  }

  if (parsed.data.manager_review) {
    if (!canMarkDemoReviewed(session)) {
      return Response.json({ error: "Permission denied" }, { status: 403 });
    }
    const mr = parsed.data.manager_review;
    const now = new Date().toISOString();
    await saveDemoSession({
      ...demo,
      ...(mr.demo_quality_score !== undefined && {
        demo_quality_score: mr.demo_quality_score,
      }),
      ...(mr.lead_quality_score !== undefined && {
        lead_quality_score: mr.lead_quality_score,
      }),
      ...(mr.ai_performance_rating !== undefined && {
        ai_performance_rating: mr.ai_performance_rating,
      }),
      ...(mr.human_takeover_rating !== undefined && {
        human_takeover_rating: mr.human_takeover_rating,
      }),
      ...(mr.review_notes !== undefined && { review_notes: mr.review_notes }),
      ...(mr.manager_notes !== undefined && { manager_notes: mr.manager_notes }),
      ...(mr.review_status !== undefined && { review_status: mr.review_status }),
      ...(mr.mark_reviewed && {
        reviewed_at: now,
        reviewed_by: session.profile.full_name ?? session.email,
        review_status: mr.review_status ?? "reviewed",
      }),
      ...(mr.mark_needs_attention && {
        review_status: "needs_attention",
        reviewed_at: now,
        reviewed_by: session.profile.full_name ?? session.email,
      }),
    });
    const reviewed = await getDemoSession(id);
    return Response.json({ session: reviewed });
  }

  if (parsed.data.agent_follow_up_notes !== undefined) {
    const { canAddFollowUpNotes } = await import("@/lib/demo/demo-recording-permissions");
    if (!canAddFollowUpNotes(session, demo)) {
      return Response.json({ error: "Permission denied" }, { status: 403 });
    }
    const now = new Date().toISOString();
    await saveDemoSession({
      ...demo,
      metadata: {
        ...(demo.metadata ?? {}),
        agent_follow_up_notes: parsed.data.agent_follow_up_notes,
        agent_follow_up_notes_at: now,
        agent_follow_up_notes_by: session.userId,
      },
    });
    if (demo.lead_id) {
      const lead = await getLead(demo.lead_id);
      if (lead) {
        const block = [lead.notes, parsed.data.agent_follow_up_notes]
          .filter(Boolean)
          .join("\n\n");
        await saveLead({ ...lead, notes: block, updated_at: now });
      }
    }
    const updated = await getDemoSession(id);
    return Response.json({ session: updated });
  }

  if (parsed.data.mark_opportunity) {
    const now = new Date().toISOString();
    await saveDemoSession({
      ...demo,
      metadata: {
        ...(demo.metadata ?? {}),
        opportunity_created: true,
        opportunity_marked_at: now,
      },
    });
    const updated = await getDemoSession(id);
    return Response.json({ session: updated });
  }

  const updated = await saveDemoSession({
    ...demo,
    ...(parsed.data.status && { status: parsed.data.status }),
    ...(parsed.data.handoff_required !== undefined && {
      handoff_required: parsed.data.handoff_required,
    }),
    ...(parsed.data.title && { title: parsed.data.title }),
  });

  return Response.json({ session: updated });
}
