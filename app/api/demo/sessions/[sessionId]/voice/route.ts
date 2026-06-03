import { handleDemoVoiceTurn } from "@/lib/demo/session-handlers";
import { withDemoPublicApi } from "@/lib/demo/demo-api";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const body = await req.json().catch(() => ({}));
  return withDemoPublicApi(() => handleDemoVoiceTurn(sessionId, body));
}
