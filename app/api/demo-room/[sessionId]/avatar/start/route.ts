import { z } from "zod";
import { hasServiceRoleKey, withPlatformAdmin } from "@/lib/platform/db";
import { getDemoSession, saveDemoSession } from "@/lib/demo/demo-data";
import { startAvatarSessionForDemo } from "@/lib/avatar/avatar-session-service";
import { getAgent } from "@/lib/platform/data";
import type { AvatarProviderId } from "@/lib/avatar/types";

const bodySchema = z.object({
  provider: z
    .enum(["tavus", "did", "internal_card", "auto"])
    .optional(),
  restart: z.boolean().optional(),
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
    let session = await getDemoSession(sessionId);
    if (!session) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const agent = session.agent_id ? await getAgent(session.agent_id) : null;

    if (
      parsed.data.provider &&
      parsed.data.provider !== "auto" &&
      agent?.avatar_enabled
    ) {
      session = await saveDemoSession({
        ...session,
        avatar_provider: parsed.data.provider as AvatarProviderId,
      });
    }

    try {
      const updated = await startAvatarSessionForDemo({
        demoSessionId: sessionId,
        organizationId: session.organization_id,
        agentId: agent?.id,
      });

      const payload: Record<string, unknown> = {
        ok: true,
        avatar_status: updated.avatar_status,
        avatar_provider: updated.avatar_provider,
        avatar_fallback_provider: updated.avatar_fallback_provider,
        avatar_stream_url: updated.avatar_stream_url,
        avatar_join_url: updated.avatar_join_url,
        avatar_session_id: updated.avatar_session_id,
        tavus_conversation_id: updated.tavus_conversation_id,
        tavus_conversation_url: updated.tavus_conversation_url,
        avatar_error: updated.avatar_error,
        selection_source:
          typeof updated.metadata?.avatar_selection_source === "string"
            ? updated.metadata.avatar_selection_source
            : null,
      };

      if (updated.avatar_provider === "did") {
        const { getDidSessionCredentialsForDemo } = await import(
          "@/lib/avatar/did-demo"
        );
        if (agent) {
          try {
            const creds = await getDidSessionCredentialsForDemo({
              demoSessionId: sessionId,
              organizationId: session.organization_id,
              agent,
            });
            payload.did_agent_id = creds.agent_id;
            payload.did_client_key = creds.client_key;
          } catch {
            /* credentials optional until connect */
          }
        }
        payload.did_stream_id = updated.did_stream_id;
        payload.did_session_id = updated.did_session_id;
      }

      return Response.json(payload);
    } catch (e) {
      const after = await getDemoSession(sessionId);
      return Response.json(
        {
          error: e instanceof Error ? e.message : "Failed to start avatar",
          avatar_status: after?.avatar_status,
          avatar_error: after?.avatar_error,
          avatar_provider: after?.avatar_provider,
          avatar_fallback_provider: after?.avatar_fallback_provider,
        },
        { status: 502 }
      );
    }
  });
}
