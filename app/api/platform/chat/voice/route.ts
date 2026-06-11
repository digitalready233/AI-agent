import { z } from "zod";
import {
  isLlmConfigured,
  isTranscriptionConfigured,
  llmConfigErrorMessage,
  transcriptionConfigErrorMessage,
} from "@/lib/agent/llm-env";
import {
  PublicChatGuardError,
  assertPublicChatRateLimit,
  assertVisitorTokenForExistingChat,
  guardResponseHeaders,
  issueVisitorToken,
  resolveAllowedPublicAgentId,
} from "@/lib/auth/public-chat-guard";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  findOrCreateConversationBySession,
  getAgent,
  getConversation,
  getConversationBySession,
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
import { buildPlatformChatResponse } from "@/lib/platform/chat/build-platform-chat-response";
import { transcribePlatformAudio } from "@/lib/platform/voice/transcribe-audio";
import { synthesizePlatformSpeech } from "@/lib/platform/voice/synthesize-speech";

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

function publicChatErrorResponse(err: PublicChatGuardError): Response {
  return guardResponseHeaders(
    Response.json({ error: err.message }, { status: err.status }),
    err.retryAfterSec
  );
}

const jsonBodySchema = z.object({
  sessionId: z.string().min(1).max(128),
  agentId: z.string().min(1),
  message: z.string().min(1).max(8000).optional(),
  channel: z.string().min(1).max(64).optional(),
  includeTts: z.boolean().optional(),
  customerMetadata: z
    .object({
      name: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      businessName: z.string().optional(),
    })
    .optional(),
});

async function runChatTurn(params: {
  req: Request;
  sessionId: string;
  agentId: string;
  message: string;
  channel: string;
  inputMode: "text" | "audio";
  includeTts: boolean;
  customerMetadata?: z.infer<typeof jsonBodySchema>["customerMetadata"];
}) {
  const agent = await withPlatformAdmin(() => getAgent(params.agentId));
  if (!agent || !agent.enabled) {
    return Response.json({ error: "Agent not found or disabled." }, { status: 404 });
  }

  const visitorToken = issueVisitorToken(params.sessionId, params.agentId);
  const turnTimestamp = new Date().toISOString();

  const result = await withPlatformAdmin(async () => {
    const existingConversation = await getConversationBySession(
      agent.organization_id,
      agent.id,
      params.sessionId
    );
    assertVisitorTokenForExistingChat(
      params.req,
      params.sessionId,
      params.agentId,
      Boolean(existingConversation)
    );

    const conversation = await findOrCreateConversationBySession({
      organizationId: agent.organization_id,
      agentId: agent.id,
      sessionId: params.sessionId,
      channel: params.channel,
    });

    if (conversationRequiresStaffHandling(conversation.status)) {
      const now = new Date().toISOString();
      const customerName =
        params.customerMetadata?.name?.trim() ||
        conversation.customer_name ||
        "Customer";

      await saveMessage({
        id: crypto.randomUUID(),
        conversation_id: conversation.id,
        sender_type: "user",
        sender_name: customerName,
        content: params.message.trim(),
        metadata: {
          channel: params.channel,
          visitor_session_id: params.sessionId,
          input_mode: params.inputMode,
          audio_source: params.inputMode === "audio",
          timestamp: turnTimestamp,
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
      customerMessage: params.message,
      channel: params.channel,
      customerMetadata: params.customerMetadata,
      inputMode: params.inputMode,
      turnTimestamp,
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
      inputMode: params.inputMode,
      transcript: params.inputMode === "audio" ? params.message : undefined,
      turnTimestamp,
      visitorToken,
    });
  }

  const workflow = result as RunAgentWorkflowResult;
  let audioBase64: string | null = null;
  let audioMimeType: string | null = null;

  if (params.includeTts) {
    const speech = await synthesizePlatformSpeech(workflow.aiResponse);
    if (speech) {
      audioBase64 = speech.audioBase64;
      audioMimeType = speech.mimeType;
    }
  }

  return Response.json({
    ...buildPlatformChatResponse(workflow, {
      transcript: params.inputMode === "audio" ? params.message : undefined,
      inputMode: params.inputMode,
      audioBase64,
      audioMimeType,
      turnTimestamp,
    }),
    visitorToken,
  });
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
    return Response.json({ error: llmConfigErrorMessage() }, { status: 503 });
  }
  if (!isTranscriptionConfigured()) {
    return Response.json(
      { error: transcriptionConfigErrorMessage() },
      { status: 503 }
    );
  }

  const contentType = req.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const sessionId = String(form.get("sessionId") ?? "").trim();
      let agentId: string;
      try {
        agentId = resolveAllowedPublicAgentId(String(form.get("agentId") ?? ""));
        if (!sessionId) {
          throw new PublicChatGuardError("sessionId is required.", 400);
        }
        assertPublicChatRateLimit(req, sessionId);
      } catch (err) {
        if (err instanceof PublicChatGuardError) return publicChatErrorResponse(err);
        throw err;
      }

      const channel = String(form.get("channel") ?? "live_agent").trim();
      const includeTts =
        String(form.get("includeTts") ?? "true").toLowerCase() !== "false";
      const audio = form.get("audio");

      if (!(audio instanceof Blob)) {
        return Response.json({ error: "audio file is required." }, { status: 400 });
      }

      try {
        await withPlatformAdmin(async () => {
          const agent = await getAgent(agentId);
          if (!agent || !agent.enabled) {
            throw new PublicChatGuardError("Agent not found or disabled.", 404);
          }
          const existingConversation = await getConversationBySession(
            agent.organization_id,
            agent.id,
            sessionId
          );
          assertVisitorTokenForExistingChat(
            req,
            sessionId,
            agentId,
            Boolean(existingConversation)
          );
        });
      } catch (err) {
        if (err instanceof PublicChatGuardError) return publicChatErrorResponse(err);
        throw err;
      }

      const mimeType = audio.type || "audio/webm";
      const buffer = Buffer.from(await audio.arrayBuffer());

      let transcript: string;
      try {
        const stt = await transcribePlatformAudio({
          audioBuffer: buffer,
          mimeType,
          filename: "live-agent.webm",
        });
        transcript = stt.transcript;
      } catch (err) {
        console.error("[POST /api/platform/chat/voice] transcription failed", err);
        return Response.json(
          {
            error:
              err instanceof Error
                ? err.message
                : "Could not transcribe audio. Try again or type your message.",
          },
          { status: 422 }
        );
      }

      return runChatTurn({
        req,
        sessionId,
        agentId,
        message: transcript,
        channel,
        inputMode: "audio",
        includeTts,
      });
    }

    const parsed = jsonBodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    let agentId: string;
    try {
      agentId = resolveAllowedPublicAgentId(parsed.data.agentId);
      assertPublicChatRateLimit(req, parsed.data.sessionId);
    } catch (err) {
      if (err instanceof PublicChatGuardError) return publicChatErrorResponse(err);
      throw err;
    }

    const message = parsed.data.message?.trim();
    if (!message) {
      return Response.json(
        { error: "message is required for JSON voice requests (or send multipart audio)." },
        { status: 400 }
      );
    }

    return runChatTurn({
      req,
      sessionId: parsed.data.sessionId,
      agentId,
      message,
      channel: parsed.data.channel ?? "live_agent",
      inputMode: "text",
      includeTts: parsed.data.includeTts ?? true,
      customerMetadata: parsed.data.customerMetadata,
    });
  } catch (err) {
    if (err instanceof PublicChatGuardError) return publicChatErrorResponse(err);
    if (err instanceof WorkflowError) {
      const body = publicWorkflowError(err);
      return Response.json(body, { status: err.statusCode });
    }
    console.error("[POST /api/platform/chat/voice]", err);
    const message =
      err instanceof Error && err.message.trim()
        ? err.message
        : "Voice chat failed. Please try again.";
    return Response.json({ error: message }, { status: 500 });
  }
}
