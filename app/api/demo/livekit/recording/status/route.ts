import { withDemoPublicApi } from "@/lib/demo/demo-api";
import { handleRecordingStatus } from "@/lib/demo/demo-recording-handlers";
import { z } from "zod";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = z
    .object({ demo_session_id: z.string().uuid() })
    .safeParse({ demo_session_id: url.searchParams.get("demo_session_id") });
  if (!parsed.success) {
    return Response.json({ error: "demo_session_id required" }, { status: 400 });
  }
  return withDemoPublicApi(() => handleRecordingStatus(parsed.data.demo_session_id));
}
