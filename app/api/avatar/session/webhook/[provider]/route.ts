import { getDemoSession, saveDemoSession } from "@/lib/demo/demo-data";
import { saveAvatarEvent } from "@/lib/avatar/avatar-events-data";
import { getAvatarProvider } from "@/lib/avatar/registry";
import type { AvatarProviderId } from "@/lib/avatar/types";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  const adapter = getAvatarProvider(provider);
  if (!adapter.handleAvatarWebhook) {
    return Response.json({ ok: true, ignored: true });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => {
    headers[k] = v;
  });

  if (provider === "did") {
    const { handleDidWebhookPayload } = await import("@/lib/avatar/did-webhook");
    const didResult = await handleDidWebhookPayload(
      (body ?? {}) as Record<string, unknown>
    );
    return Response.json({ ok: true, matched: didResult.matched });
  }

  if (provider === "tavus") {
    const { handleTavusWebhookPayload } = await import("@/lib/avatar/tavus-webhook");
    const tavusResult = await handleTavusWebhookPayload(
      (body ?? {}) as Record<string, unknown>
    );
    return Response.json({ ok: true, matched: tavusResult.matched });
  }

  const result = await adapter.handleAvatarWebhook!(
    provider as AvatarProviderId,
    body,
    headers
  );

  if (result.demoSessionId) {
    const session = await getDemoSession(result.demoSessionId);
    if (session) {
      await saveAvatarEvent({
        organization_id: session.organization_id,
        demo_session_id: session.id,
        provider,
        event_type: result.eventType ?? "webhook",
        payload: result.payload ?? {},
      });
      if (result.status) {
        await saveDemoSession({
          ...session,
          avatar_status: result.status,
        });
      }
    }
  }

  return Response.json({ ok: true });
}
