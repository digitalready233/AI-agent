import { withDemoPublicApi } from "@/lib/demo/demo-api";
import { handleLiveKitAiMessage } from "@/lib/demo/demo-livekit-ai-handlers";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  return withDemoPublicApi(() => handleLiveKitAiMessage(body));
}
