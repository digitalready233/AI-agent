import { handleDemoTranscribe } from "@/lib/demo/session-handlers";
import { withDemoPublicApi } from "@/lib/demo/demo-api";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const form = await req.formData().catch(() => null);
  return withDemoPublicApi(() => handleDemoTranscribe(sessionId, form));
}
