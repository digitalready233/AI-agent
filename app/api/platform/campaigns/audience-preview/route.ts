import { z } from "zod";
import { requireSession } from "@/lib/platform/auth";
import { previewCampaignAudienceCount } from "@/lib/platform/campaign-audience";

const schema = z.object({
  audience_filters: z.record(z.unknown()).optional(),
  channel: z.string().optional(),
});

export async function POST(req: Request) {
  const { organization } = await requireSession();
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const count = await previewCampaignAudienceCount(
    organization.id,
    parsed.data.audience_filters ?? {},
    { channel: parsed.data.channel }
  );

  return Response.json({ count });
}
