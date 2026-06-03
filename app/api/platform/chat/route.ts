import { z } from "zod";
import { isLlmConfigured } from "@/lib/agent/llm-env";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  findOrCreateConversationBySession,
  getAgent,
  getConversation,
  listMessages,
  saveConversation,
  saveMessage,
} from "@/lib/platform/data";
import {
  conversationRequiresStaffHandling,
  mapConversationToVisitorSync,
  VISITOR_STAFF_QUEUE_ACK,
} from "@/lib/platform/visitor-chat";
import { hasServiceRoleKey, withPlatformAdmin } from "@/lib/platform/db";
import {
  classifyLlmError,
  visitorLlmErrorMessage,
} from "@/lib/agent/llm-errors";
import {
  runAgentWorkflow,
  WorkflowError,
  type RunAgentWorkflowResult,
} from "@/lib/platform/workflow";

/** Workflow runs analyze + respond LLM calls; allow long Groq/OpenAI latency in dev. */
export const maxDuration = 300;

function publicWorkflowError(err: WorkflowError): { error: string; code: string } {
  if (err.code === "LLM_QUOTA_EXCEEDED" || err.code === "LLM_REQUEST_FAILED") {
    return {
      error: visitorLlmErrorMessage(
        err.code === "LLM_QUOTA_EXCEEDED" ? "quota" : classifyLlmError(err)
      ),
      code: err.code,
    };
  }
  return { error: err.message, code: err.code };
}

const bodySchema = z.object({
  sessionId: z.string().min(1).max(128),
  agentId: z.string().min(1),
  message: z.string().min(1).max(8000),
  channel: z.string().min(1).max(64).optional(),
  customerMetadata: z
    .object({
      name: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      businessName: z.string().optional(),
    })
    .optional(),
});

function resolvePlatformAgentId(bodyAgentId: string | undefined): string {
  const fromBody = bodyAgentId?.trim();
  if (fromBody) return fromBody;
  return (
    process.env.PLATFORM_AGENT_ID?.trim() ||
    process.env.NEXT_PUBLIC_PLATFORM_AGENT_ID?.trim() ||
    ""
  );
}

export async function POST(req: Request) {
  if (!isSupabaseConfigured()) {
    return Response.json(
      { error: "Supabase is not configured for platform chat." },
      { status: 503 }
    );
  }
  if (!hasServiceRoleKey()) {
    return Response.json(
      {
        error:
          "SUPABASE_SERVICE_ROLE_KEY is required for public chat (server-only). Add it in .env.local and restart.",
      },
      { status: 503 }
    );
  }
  if (!isLlmConfigured()) {
    return Response.json(
      { error: "LLM not configured. Set OPENAI_API_KEY on the server." },
      { status: 503 }
    );
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const agentId = resolvePlatformAgentId(parsed.data.agentId);
  if (!agentId) {
    return Response.json({ error: "agentId is required." }, { status: 400 });
  }
  const agent = await withPlatformAdmin(() => getAgent(agentId));
  if (!agent || !agent.enabled) {
    return Response.json({ error: "Agent not found or disabled." }, { status: 404 });
  }

  try {
    const result = await withPlatformAdmin(async () => {
      const conversation = await findOrCreateConversationBySession({
        organizationId: agent.organization_id,
        agentId: agent.id,
        sessionId: parsed.data.sessionId,
        channel: parsed.data.channel ?? "website",
      });

      if (conversationRequiresStaffHandling(conversation.status)) {
        const now = new Date().toISOString();
        const customerName =
          parsed.data.customerMetadata?.name?.trim() ||
          conversation.customer_name ||
          "Customer";

        await saveMessage({
          id: crypto.randomUUID(),
          conversation_id: conversation.id,
          sender_type: "user",
          sender_name: customerName,
          content: parsed.data.message.trim(),
          metadata: {
            channel: parsed.data.channel ?? "website",
            visitor_session_id: parsed.data.sessionId,
          },
          created_at: now,
        });

        await saveConversation({
          ...conversation,
          updated_at: now,
        });

        const rows = await listMessages(conversation.id);
        const refreshed = await getConversation(conversation.id);
        const sync = mapConversationToVisitorSync(refreshed ?? conversation, rows);

        return {
          kind: "staff_queue" as const,
          sync,
          ack: VISITOR_STAFF_QUEUE_ACK,
        };
      }

      return runAgentWorkflow({
        organizationId: agent.organization_id,
        agentId: agent.id,
        conversationId: conversation.id,
        customerMessage: parsed.data.message,
        channel: parsed.data.channel ?? "website",
        customerMetadata: parsed.data.customerMetadata,
      });
    });

    if ("kind" in result && result.kind === "staff_queue") {
      return Response.json({
        staffHandling: true,
        handoffRequired: true,
        handoffActive: result.sync.handoffActive,
        staffJoined: result.sync.staffJoined,
        conversationId: result.sync.conversationId,
        status: result.sync.status,
        reply: result.ack,
        messages: result.sync.messages,
      });
    }

    const workflow = result as RunAgentWorkflowResult;
    return Response.json({
      reply: workflow.aiResponse,
      conversationId: workflow.conversationId,
      leadId: workflow.leadId,
      handoffRequired: workflow.handoffRequired,
      handoffMessage: workflow.handoffRequired
        ? workflow.handoffVisitorMessage
        : undefined,
      handoffActive: workflow.handoffRequired,
      suggestBooking: workflow.suggestBooking,
      bookingRecommended: workflow.bookingRecommended,
      suggestedMeetingType: workflow.suggestedMeetingType,
      preferredDateTime: workflow.preferredDateTime,
      bookingProvider: workflow.bookingProvider,
      nextAction: workflow.nextAction,
      calendlyEmbedUrl: workflow.calendlyEmbedUrl,
      meetingTypeKey: workflow.meetingTypeKey,
      detectedIntent: workflow.detectedIntent,
      conversationStage: workflow.conversationStage,
      leadScore: workflow.leadScore,
      leadCategory: workflow.leadCategory,
      leadStatus: workflow.leadStatus,
      recommendedNextAction: workflow.recommendedNextAction,
    });
  } catch (err) {
    if (err instanceof WorkflowError) {
      const body = publicWorkflowError(err);
      return Response.json(body, { status: err.statusCode });
    }
    console.error("[POST /api/platform/chat]", err);
    return Response.json({ error: "Chat failed" }, { status: 500 });
  }
}
