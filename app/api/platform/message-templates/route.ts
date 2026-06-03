import { z } from "zod";
import { requireSession } from "@/lib/platform/auth";
import {
  listMessageTemplates,
  saveMessageTemplate,
} from "@/lib/platform/campaign-automation-data";
import type { MessageTemplate, MessageTemplateStatus } from "@/lib/platform/campaign-types";

const templateSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  channel: z.enum(["whatsapp", "email", "voice", "voice_future"]).default("whatsapp"),
  campaign_type: z.string().optional().nullable(),
  body: z.string().min(1),
  variables: z.array(z.string()).optional(),
  whatsapp_template_name: z.string().optional().nullable(),
  status: z.enum(["draft", "approved", "rejected", "active"]).optional(),
});

export async function GET() {
  const { organization } = await requireSession();
  const templates = await listMessageTemplates(organization.id);
  return Response.json({ templates });
}

export async function POST(req: Request) {
  const { organization } = await requireSession();
  const parsed = templateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;
  const now = new Date().toISOString();
  const row: MessageTemplate = {
    id: d.id ?? crypto.randomUUID(),
    organization_id: organization.id,
    name: d.name,
    channel: d.channel,
    campaign_type: d.campaign_type ?? null,
    body: d.body,
    variables: d.variables ?? [],
    whatsapp_template_name: d.whatsapp_template_name ?? null,
    status: (d.status as MessageTemplateStatus) ?? "draft",
    created_at: now,
    updated_at: now,
  };

  const saved = await saveMessageTemplate(row);
  return Response.json({ template: saved }, { status: 201 });
}
