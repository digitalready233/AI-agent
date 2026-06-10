import { z } from "zod";
import { handleDemoSessionToken } from "@/lib/demo/session-handlers";
import { withDemoPublicApi } from "@/lib/demo/demo-api";
import { getSessionContext } from "@/lib/platform/auth";

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

  let authenticatedStaffOrgId: string | null = null;
  if (parsed.data.role === "staff") {
    const ctx = await getSessionContext();
    if (!ctx) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    authenticatedStaffOrgId = ctx.organization.id;
  }

  return withDemoPublicApi(() =>
    handleDemoSessionToken(sessionId, parsed.data, {
      authenticatedStaffOrgId,
    })
  );
}
