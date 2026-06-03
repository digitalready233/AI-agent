import { z } from "zod";
import { requireSession } from "@/lib/platform/auth";
import { requirePermission } from "@/lib/platform/rbac";
import {
  getWhatsAppSettings,
  saveWhatsAppSettings,
} from "@/lib/whatsapp/settings-data";
import type { WhatsAppMessageTemplate } from "@/lib/whatsapp/types";

const templateSchema = z.object({
  name: z.string().min(1).max(128),
  meta_template_name: z.string().max(128).optional(),
  language: z.string().min(2).max(16).default("en"),
  category: z.enum(["marketing", "utility", "authentication"]).default("marketing"),
  body_preview: z.string().min(1).max(1024),
});

const patchSchema = z.object({
  id: z.string().uuid(),
  meta_template_name: z.string().max(128).optional().nullable(),
  status: z.enum(["draft", "pending_approval", "approved"]).optional(),
  language: z.string().min(2).max(16).optional(),
});

export async function GET() {
  const session = await requireSession();
  requirePermission(session, "integrations.manage");

  const settings = await getWhatsAppSettings(session.organization.id);
  return Response.json({
    templates: settings.message_templates,
    note:
      "Template placeholders for outbound campaigns. Submit approved templates in Meta Business Manager; sync via API can be added later.",
  });
}

export async function POST(req: Request) {
  const session = await requireSession();
  requirePermission(session, "integrations.manage");

  const parsed = templateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const settings = await getWhatsAppSettings(session.organization.id);
  const draft: WhatsAppMessageTemplate = {
    id: crypto.randomUUID(),
    name: parsed.data.name,
    meta_template_name: parsed.data.meta_template_name?.trim() || null,
    language: parsed.data.language,
    category: parsed.data.category,
    status: "draft",
    body_preview: parsed.data.body_preview,
    created_at: new Date().toISOString(),
  };

  const updated = await saveWhatsAppSettings({
    ...settings,
    message_templates: [...settings.message_templates, draft],
  });

  return Response.json({ template: draft, templates: updated.message_templates });
}

export async function PATCH(req: Request) {
  const session = await requireSession();
  requirePermission(session, "integrations.manage");

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const settings = await getWhatsAppSettings(session.organization.id);
  const idx = settings.message_templates.findIndex((t) => t.id === parsed.data.id);
  if (idx < 0) {
    return Response.json({ error: "Template not found" }, { status: 404 });
  }

  const current = settings.message_templates[idx];
  const next: WhatsAppMessageTemplate = {
    ...current,
    ...(parsed.data.meta_template_name !== undefined
      ? { meta_template_name: parsed.data.meta_template_name }
      : {}),
    ...(parsed.data.status ? { status: parsed.data.status } : {}),
    ...(parsed.data.language ? { language: parsed.data.language } : {}),
  };

  const templates = [...settings.message_templates];
  templates[idx] = next;

  const updated = await saveWhatsAppSettings({
    ...settings,
    message_templates: templates,
  });

  return Response.json({ template: next, templates: updated.message_templates });
}

export async function DELETE(req: Request) {
  const session = await requireSession();
  requirePermission(session, "integrations.manage");

  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return Response.json({ error: "id required" }, { status: 400 });
  }

  const settings = await getWhatsAppSettings(session.organization.id);
  const updated = await saveWhatsAppSettings({
    ...settings,
    message_templates: settings.message_templates.filter((t) => t.id !== id),
  });

  return Response.json({ templates: updated.message_templates });
}
