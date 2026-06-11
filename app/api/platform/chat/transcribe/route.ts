import {
  PublicChatGuardError,
  assertPublicChatRateLimit,
  guardResponseHeaders,
  resolveAllowedPublicAgentId,
} from "@/lib/auth/public-chat-guard";
import {
  isTranscriptionConfigured,
  transcriptionConfigErrorMessage,
} from "@/lib/agent/llm-env";
import { getAgent } from "@/lib/platform/data";
import { hasServiceRoleKey, withPlatformAdmin } from "@/lib/platform/db";
import { transcribePlatformAudio } from "@/lib/platform/voice/transcribe-audio";
import { isSupabaseConfigured } from "@/lib/supabase/env";

function publicChatErrorResponse(err: PublicChatGuardError): Response {
  return guardResponseHeaders(
    Response.json({ error: err.message }, { status: err.status }),
    err.retryAfterSec
  );
}

/** Speech-to-text only — fills the composer before the user sends a message. */
export async function POST(req: Request) {
  if (!isSupabaseConfigured() || !hasServiceRoleKey()) {
    return Response.json(
      { error: "Platform chat is not configured on the server." },
      { status: 503 }
    );
  }
  if (!isTranscriptionConfigured()) {
    return Response.json(
      { error: transcriptionConfigErrorMessage() },
      { status: 503 }
    );
  }

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return Response.json({ error: "Expected multipart audio upload." }, { status: 400 });
  }

  try {
    const form = await req.formData();
    const sessionId = String(form.get("sessionId") ?? "").trim();
    const agentId = resolveAllowedPublicAgentId(String(form.get("agentId") ?? ""));
    if (!sessionId) {
      throw new PublicChatGuardError("sessionId is required.", 400);
    }
    assertPublicChatRateLimit(req, sessionId);

    await withPlatformAdmin(async () => {
      const agent = await getAgent(agentId);
      if (!agent || !agent.enabled) {
        throw new PublicChatGuardError("Agent not found or disabled.", 404);
      }
    });

    const audio = form.get("audio");
    if (!(audio instanceof Blob)) {
      return Response.json({ error: "audio file is required." }, { status: 400 });
    }

    const buffer = Buffer.from(await audio.arrayBuffer());
    const stt = await transcribePlatformAudio({
      audioBuffer: buffer,
      mimeType: audio.type || "audio/webm",
      filename: "composer-dictation.webm",
    });

    return Response.json({ transcript: stt.transcript.trim() });
  } catch (err) {
    if (err instanceof PublicChatGuardError) return publicChatErrorResponse(err);
    console.error("[POST /api/platform/chat/transcribe]", err);
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
}
