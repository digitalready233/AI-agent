import { z } from "zod";
import { handleDemoSessionToken } from "@/lib/demo/session-handlers";
import { withDemoPublicApi } from "@/lib/demo/demo-api";

const bodySchema = z.object({
  identity: z.string().max(120).optional(),
  name: z.string().max(120).optional(),
  role: z.enum(["prospect", "staff"]).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  return withDemoPublicApi(() =>
    handleDemoSessionToken(sessionId, parsed.data)
  );
}
