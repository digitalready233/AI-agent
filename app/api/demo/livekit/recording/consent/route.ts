import { withDemoPublicApi } from "@/lib/demo/demo-api";
import { handleRecordingConsent } from "@/lib/demo/demo-recording-handlers";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  return withDemoPublicApi(() => handleRecordingConsent(body));
}
