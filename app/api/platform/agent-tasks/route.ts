import { z } from "zod";
import { requireSession } from "@/lib/platform/auth";
import { deleteAgentTask, listAgentTasks, saveAgentTask } from "@/lib/platform/data";
import type { AgentTask } from "@/lib/platform/types";

const taskSchema = z.object({
  id: z.string().optional(),
  agent_id: z.string().optional().nullable(),
  name: z.string().min(1),
  trigger_type: z.string().min(1),
  action_type: z.string().min(1),
  webhook_url: z.string().optional(),
  http_method: z.string().optional(),
  headers: z.record(z.string()).optional(),
  payload_template: z.string().optional(),
  status: z.string().optional(),
});

export async function GET() {
  const { organization } = await requireSession();
  const tasks = await listAgentTasks(organization.id);
  return Response.json({ tasks });
}

export async function POST(req: Request) {
  const { organization } = await requireSession();
  const parsed = taskSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const now = new Date().toISOString();
  const d = parsed.data;
  const task: AgentTask = {
    id: crypto.randomUUID(),
    organization_id: organization.id,
    agent_id: d.agent_id ?? null,
    name: d.name,
    trigger_type: d.trigger_type,
    action_type: d.action_type,
    webhook_url: d.webhook_url ?? null,
    http_method: d.http_method ?? "POST",
    headers: d.headers ?? {},
    payload_template: d.payload_template ?? null,
    status: d.status ?? "active",
    created_at: now,
    updated_at: now,
  };

  const saved = await saveAgentTask(task);
  return Response.json({ task: saved }, { status: 201 });
}

export async function PUT(req: Request) {
  const { organization } = await requireSession();
  const parsed = taskSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;
  if (!d.id) {
    return Response.json({ error: "Task id required" }, { status: 400 });
  }

  const all = await listAgentTasks(organization.id);
  const existing = all.find((t) => t.id === d.id);
  if (!existing) {
    return Response.json({ error: "Task not found" }, { status: 404 });
  }

  const task: AgentTask = {
    ...existing,
    name: d.name,
    agent_id: d.agent_id ?? existing.agent_id,
    trigger_type: d.trigger_type,
    action_type: d.action_type,
    webhook_url: d.webhook_url ?? existing.webhook_url,
    http_method: d.http_method ?? existing.http_method,
    headers: d.headers ?? existing.headers,
    payload_template: d.payload_template ?? existing.payload_template,
    status: d.status ?? existing.status,
    updated_at: new Date().toISOString(),
  };

  const saved = await saveAgentTask(task);
  return Response.json({ task: saved });
}

export async function DELETE(req: Request) {
  const { organization } = await requireSession();
  const id = new URL(req.url).searchParams.get("id")?.trim();
  if (!id) {
    return Response.json({ error: "id required" }, { status: 400 });
  }

  const all = await listAgentTasks(organization.id);
  if (!all.some((t) => t.id === id)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await deleteAgentTask(id);
  return Response.json({ ok: true });
}
