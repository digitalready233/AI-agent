import { WebhookReceiver } from "livekit-server-sdk";
import { isLiveKitEnvConfigured } from "@/lib/demo/demo-provider";
import { handleRecordingWebhook } from "@/lib/demo/demo-recording-handlers";

export async function POST(req: Request) {
  if (!isLiveKitEnvConfigured()) {
    return Response.json({ error: "LiveKit not configured" }, { status: 503 });
  }

  const body = await req.text();
  const auth = req.headers.get("authorization") ?? "";

  const receiver = new WebhookReceiver(
    process.env.LIVEKIT_API_KEY!.trim(),
    process.env.LIVEKIT_API_SECRET!.trim()
  );

  let event: { event?: string; egressInfo?: Record<string, unknown> };
  try {
    event = (await receiver.receive(body, auth)) as typeof event;
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Invalid webhook" },
      { status: 401 }
    );
  }

  if (event.event === "egress_ended" || event.event === "egress_updated") {
    const info = event.egressInfo ?? {};
    const fileResults = info.fileResults as Array<{ location?: string; duration?: number }> | undefined;
    const result = await handleRecordingWebhook({
      egress_id: info.egressId as string | undefined,
      egressId: info.egressId as string | undefined,
      file_results: fileResults,
      error: info.error as string | undefined,
    });
    return Response.json(result.body, { status: result.status });
  }

  return Response.json({ ok: true, ignored: true });
}
