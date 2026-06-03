import { z } from "zod";
import { requireSession } from "@/lib/platform/auth";
import {
  deleteKnowledgeBase,
  deleteKnowledgeEntry,
  listKnowledgeBases,
  listKnowledgeEntries,
  saveKnowledgeBase,
  saveKnowledgeEntry,
} from "@/lib/platform/data";
import type { KnowledgeBase, KnowledgeEntry } from "@/lib/platform/types";

const kbSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(["active", "archived", "draft"]).optional(),
});

const entrySchema = z.object({
  id: z.string().optional(),
  knowledge_base_id: z.string().min(1),
  title: z.string().min(1),
  category: z.string().min(1),
  content: z.string().min(1),
  status: z.string().optional(),
});

export async function GET(req: Request) {
  const { organization } = await requireSession();
  const kbId = new URL(req.url).searchParams.get("kbId") ?? undefined;
  const [bases, entries] = await Promise.all([
    listKnowledgeBases(organization.id),
    listKnowledgeEntries(organization.id, kbId),
  ]);
  return Response.json({ knowledgeBases: bases, entries });
}

export async function POST(req: Request) {
  const { organization } = await requireSession();
  const body = await req.json();

  if (body.type === "entry") {
    const parsed = entrySchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const now = new Date().toISOString();
    const entry: KnowledgeEntry = {
      id: crypto.randomUUID(),
      knowledge_base_id: parsed.data.knowledge_base_id,
      organization_id: organization.id,
      title: parsed.data.title,
      category: parsed.data.category,
      content: parsed.data.content,
      status: parsed.data.status ?? "active",
      created_at: now,
      updated_at: now,
    };
    const saved = await saveKnowledgeEntry(entry);
    return Response.json({ entry: saved }, { status: 201 });
  }

  const parsed = kbSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const now = new Date().toISOString();
  const kb: KnowledgeBase = {
    id: crypto.randomUUID(),
    organization_id: organization.id,
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    status: parsed.data.status ?? "active",
    created_at: now,
    updated_at: now,
  };
  const saved = await saveKnowledgeBase(kb);
  return Response.json({ knowledgeBase: saved }, { status: 201 });
}

export async function PUT(req: Request) {
  const { organization } = await requireSession();
  const body = await req.json();

  if (body.type === "entry") {
    const parsed = entrySchema.extend({ id: z.string().min(1) }).safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const entries = await listKnowledgeEntries(organization.id);
    const existing = entries.find((e) => e.id === parsed.data.id);
    if (!existing) {
      return Response.json({ error: "Entry not found" }, { status: 404 });
    }
    const entry: KnowledgeEntry = {
      ...existing,
      title: parsed.data.title,
      category: parsed.data.category,
      content: parsed.data.content,
      status: parsed.data.status ?? existing.status,
      updated_at: new Date().toISOString(),
    };
    const saved = await saveKnowledgeEntry(entry);
    return Response.json({ entry: saved });
  }

  const parsed = kbSchema.extend({ id: z.string().min(1) }).safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const bases = await listKnowledgeBases(organization.id);
  const existing = bases.find((k) => k.id === parsed.data.id);
  if (!existing) {
    return Response.json({ error: "Knowledge base not found" }, { status: 404 });
  }

  const kb: KnowledgeBase = {
    ...existing,
    title: parsed.data.title,
    description: parsed.data.description ?? existing.description,
    status: parsed.data.status ?? existing.status,
    updated_at: new Date().toISOString(),
  };
  const saved = await saveKnowledgeBase(kb);
  return Response.json({ knowledgeBase: saved });
}

export async function DELETE(req: Request) {
  const { organization } = await requireSession();
  const params = new URL(req.url).searchParams;
  const id = params.get("id")?.trim();
  const type = params.get("type");

  if (!id) {
    return Response.json({ error: "id required" }, { status: 400 });
  }

  if (type === "entry") {
    await deleteKnowledgeEntry(id);
    return Response.json({ ok: true });
  }

  const bases = await listKnowledgeBases(organization.id);
  if (!bases.some((k) => k.id === id)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  await deleteKnowledgeBase(id);
  return Response.json({ ok: true });
}
