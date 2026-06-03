import { withDemoPublicApi } from "@/lib/demo/demo-api";
import { handleLiveKitAiRestart } from "@/lib/demo/demo-livekit-ai-handlers";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  return withDemoPublicApi(() => handleLiveKitAiRestart(body));
}
