import { z } from "zod";
import { requireSession } from "@/lib/platform/auth";
import {
  deleteMessageTemplate,
  getMessageTemplate,
  saveMessageTemplate,
} from "@/lib/platform/campaign-automation-data";
import type { MessageTemplateStatus } from "@/lib/platform/campaign-types";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  channel: z.enum(["whatsapp", "email", "voice", "voice_future"]).optional(),
  campaign_type: z.string().optional().nullable(),
  body: z.string().min(1).optional(),
  variables: z.array(z.string()).optional(),
  whatsapp_template_name: z.string().optional().nullable(),
  status: z.enum(["draft", "approved", "rejected", "active"]).optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { organization } = await requireSession();
  const { id } = await params;
  const template = await getMessageTemplate(id);
  if (!template || template.organization_id !== organization.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json({ template });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { organization } = await requireSession();
  const { id } = await params;
  const existing = await getMessageTemplate(id);
  if (!existing || existing.organization_id !== organization.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;
  const saved = await saveMessageTemplate({
    ...existing,
    ...d,
    status: (d.status as MessageTemplateStatus) ?? existing.status,
    updated_at: new Date().toISOString(),
  });
  return Response.json({ template: saved });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { organization } = await requireSession();
  const { id } = await params;
  const existing = await getMessageTemplate(id);
  if (!existing || existing.organization_id !== organization.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  await deleteMessageTemplate(id, organization.id);
  return Response.json({ ok: true });
}
