import { requireSession } from "@/lib/platform/auth";
import { buildAgentDraftFromPrompt } from "@/lib/platform/agent-from-prompt";

export async function POST(req: Request) {
  const { organization } = await requireSession();
  const body = (await req.json()) as { description?: string };
  const description = body.description?.trim();

  if (!description || description.length < 12) {
    return Response.json(
      { error: "Describe your agent in at least 12 characters." },
      { status: 400 }
    );
  }

  const draft = buildAgentDraftFromPrompt(description, organization.name);
  return Response.json({ draft });
}
