import { requireSession } from "@/lib/platform/auth";
import { ensurePrimaryAgent } from "@/lib/platform/data";
import { writePlatformAgentIdToEnv } from "@/lib/platform/write-env-agent-id";

export async function POST() {
  if (process.env.NODE_ENV !== "development") {
    return Response.json({ error: "Only available in development." }, { status: 403 });
  }

  const { organization } = await requireSession();
  const agent = await ensurePrimaryAgent(organization.id, organization.name);
  await writePlatformAgentIdToEnv(agent.id);

  return Response.json({
    ok: true,
    agentId: agent.id,
    message: "Updated .env.local — restart npm run dev if live chat does not pick up the id.",
  });
}
