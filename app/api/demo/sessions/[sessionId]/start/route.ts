import { handleDemoSessionStart } from "@/lib/demo/session-handlers";
import { withDemoPublicApi } from "@/lib/demo/demo-api";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  return withDemoPublicApi(() => handleDemoSessionStart(sessionId));
}
