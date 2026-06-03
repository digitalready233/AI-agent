import { z } from "zod";
import { requireSession } from "@/lib/platform/auth";
import { findOrCreateConversationBySession } from "@/lib/platform/data";

const bodySchema = z.object({
  agentId: z.string().min(1),
  sessionId: z.string().min(1).max(128).optional(),
  channel: z.string().min(1).max(64).optional(),
});

export async function POST(req: Request) {
  const { organization } = await requireSession();
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const sessionId =
    parsed.data.sessionId?.trim() ||
    `test_${organization.id}_${parsed.data.agentId}_${crypto.randomUUID()}`;

  const conversation = await findOrCreateConversationBySession({
    organizationId: organization.id,
    agentId: parsed.data.agentId,
    sessionId,
    channel: parsed.data.channel ?? "test",
  });

  return Response.json({ conversation }, { status: 201 });
}
