import {
  PublicChatGuardError,
  assertPublicChatRateLimit,
  assertVisitorTokenForExistingChat,
  resolveAllowedPublicAgentId,
} from "@/lib/auth/public-chat-guard";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { hasServiceRoleKey, withPlatformAdmin } from "@/lib/platform/db";
import {
  loadVisitorChatSync,
  visitorSyncFingerprint,
} from "@/lib/platform/visitor-chat-sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Server-Sent Events for visitor handoff (replaces client polling when supported). */
export const maxDuration = 300;

const TICK_MS = 2_000;
const HEARTBEAT_MS = 15_000;

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
      return;
    }
    const id = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(id);
        reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
      },
      { once: true }
    );
  });
}

export async function GET(req: Request) {
  if (!isSupabaseConfigured() || !hasServiceRoleKey()) {
    return Response.json({ error: "Chat stream unavailable." }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId")?.trim();
  const fromQuery = searchParams.get("agentId")?.trim();

  if (!sessionId) {
    return Response.json(
      { error: "sessionId and agentId are required." },
      { status: 400 }
    );
  }

  let agentId: string;
  try {
    agentId = resolveAllowedPublicAgentId(fromQuery || "");
    assertPublicChatRateLimit(req, sessionId);
    assertVisitorTokenForExistingChat(req, sessionId, agentId, true);
  } catch (err) {
    if (err instanceof PublicChatGuardError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      let lastFingerprint = "";
      let lastHeartbeat = Date.now();

      try {
        while (!req.signal.aborted) {
          const payload = await withPlatformAdmin(() =>
            loadVisitorChatSync({ sessionId, agentId })
          );

          if (!payload) {
            send("error", { error: "Conversation not found." });
            break;
          }

          const fingerprint = visitorSyncFingerprint(payload);
          if (fingerprint !== lastFingerprint) {
            lastFingerprint = fingerprint;
            send("sync", payload);
          } else if (Date.now() - lastHeartbeat >= HEARTBEAT_MS) {
            send("heartbeat", { at: new Date().toISOString() });
            lastHeartbeat = Date.now();
          }

          await sleep(TICK_MS, req.signal);
        }
      } catch (err) {
        if (
          err instanceof DOMException &&
          err.name === "AbortError"
        ) {
          // client disconnected
        } else {
          console.error("[GET /api/platform/chat/stream]", err);
          try {
            send("error", { error: "Stream failed." });
          } catch {
            /* stream already closed */
          }
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
