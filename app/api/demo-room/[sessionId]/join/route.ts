import { z } from "zod";
import {
  findOrCreateConversationBySession,
  getAgent,
  getLead,
  saveConversation,
  saveLead,
} from "@/lib/platform/data";
import { hasServiceRoleKey, withPlatformAdmin } from "@/lib/platform/db";
import {
  getDemoSession,
  listDemoMessages,
  saveDemoMessage,
  saveDemoParticipant,
  saveDemoSession,
} from "@/lib/demo/demo-data";
const bodySchema = z.object({
  display_name: z.string().max(120).optional(),
  name: z.string().max(120).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(40).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  if (!hasServiceRoleKey()) {
    return Response.json({ error: "Demo room not configured." }, { status: 503 });
  }

  const { sessionId } = await params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  return withPlatformAdmin(async () => {
    const session = await getDemoSession(sessionId);
    if (!session) {
      return Response.json({ error: "Demo not found" }, { status: 404 });
    }

    const entryStatus = session.status;
    if (entryStatus === "completed" || entryStatus === "cancelled") {
      return Response.json({ error: "This demo has already ended." }, { status: 400 });
    }

    const agent = session.agent_id ? await getAgent(session.agent_id) : null;
    if (!agent?.enabled) {
      return Response.json({ error: "Demo not available" }, { status: 404 });
    }

    const { ensureDemoExperienceForAgent } = await import(
      "@/lib/demo/ensure-demo-setup"
    );
    await ensureDemoExperienceForAgent({
      organizationId: session.organization_id,
      agentId: agent.id,
    });

    let scheduledLeadContext = "";
    if (session.lead_id) {
      const lead = await getLead(session.lead_id);
      if (lead) {
        scheduledLeadContext = [
          lead.full_name && `Name: ${lead.full_name}`,
          lead.business_name && `Business: ${lead.business_name}`,
          lead.service_interest && `Interest: ${lead.service_interest}`,
          lead.budget && `Budget: ${lead.budget}`,
          lead.timeline && `Timeline: ${lead.timeline}`,
        ]
          .filter(Boolean)
          .join("\n");
      }
    }

    const now = new Date().toISOString();
    const guestName =
      parsed.data.name?.trim() ||
      parsed.data.display_name?.trim() ||
      "Guest";
    await saveDemoParticipant({
      id: crypto.randomUUID(),
      organization_id: session.organization_id,
      demo_session_id: sessionId,
      role: "prospect",
      lead_id: session.lead_id,
      name: guestName,
      display_name: guestName,
      email: parsed.data.email ?? null,
      phone: parsed.data.phone ?? null,
      joined_at: now,
      left_at: null,
      created_at: now,
    });

    const welcome =
      session.entry_mode === "scheduled" && scheduledLeadContext
        ? `Welcome back! I'm ${agent.name}. I've reviewed your details — what would you like to focus on in today's demo?`
        : agent.welcome_message ??
          `Welcome! I'm ${agent.name}, your AI sales demo specialist. What would you like to explore today — social media, website, advertising, branding, or a full growth package?`;

    let conversationId = session.conversation_id;
    if (session.agent_id) {
      let conv = await findOrCreateConversationBySession({
        organizationId: session.organization_id,
        agentId: session.agent_id,
        sessionId,
        channel: "demo_call",
      });
      conversationId = conv.id;

      if (session.lead_id) {
        let lead = await getLead(session.lead_id);
        if (lead) {
          if (parsed.data.display_name?.trim()) {
            lead = { ...lead, full_name: parsed.data.display_name.trim() };
          }
          if (parsed.data.email) {
            lead = { ...lead, email: parsed.data.email };
          }
          await saveLead({ ...lead, updated_at: now });
          conv = await saveConversation({
            ...conv,
            lead_id: lead.id,
            customer_name: lead.full_name,
            customer_email: lead.email,
            customer_phone: lead.phone,
            updated_at: now,
          });
        }
      }
    }

    const priorMessages = await listDemoMessages(sessionId);
    const hasAgentMessage = priorMessages.some((m) => m.sender_type === "agent");

    await saveDemoSession({
      ...session,
      conversation_id: conversationId ?? session.conversation_id,
      status: "in_progress",
      started_at: session.started_at ?? now,
    });

    const { recordDemoTimelineEvent } = await import("@/lib/demo/demo-timeline-data");
    await recordDemoTimelineEvent({
      demoSessionId: sessionId,
      organizationId: session.organization_id,
      eventType: "prospect_joined",
      title: "Prospect joined",
      description: guestName,
    });

    if (!hasAgentMessage) {
      await saveDemoMessage({
        id: crypto.randomUUID(),
        organization_id: session.organization_id,
        demo_session_id: sessionId,
        sender_type: "agent",
        sender_name: agent.name,
        content: welcome,
        created_at: now,
      });
    }

    const messages = await listDemoMessages(sessionId);

    return Response.json({
      joined: true,
      welcome_message: hasAgentMessage ? null : welcome,
      conversation_id: conversationId ?? null,
      agent: { id: agent.id, name: agent.name },
      messages: messages.map((m) => ({
        sender_type: m.sender_type,
        sender_name: m.sender_name,
        content: m.content,
      })),
    });
  });
}
