import { z } from "zod";
import { requireSession } from "@/lib/platform/auth";
import { listAgentTasks, saveAgentTask } from "@/lib/platform/data";

const schema = z.object({
  taskId: z.string().min(1),
});

export async function POST(req: Request) {
  const { organization } = await requireSession();
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const tasks = await listAgentTasks(organization.id);
  const task = tasks.find((t) => t.id === parsed.data.taskId);
  if (!task) {
    return Response.json({ error: "Task not found" }, { status: 404 });
  }

  if (!task.webhook_url?.trim()) {
    return Response.json({ error: "No webhook URL configured" }, { status: 400 });
  }

  const payload = task.payload_template
    ? JSON.parse(
        task.payload_template
          .replace("{{trigger}}", task.trigger_type)
          .replace("{{task}}", task.name)
      )
    : {
        event: task.trigger_type,
        task: task.name,
        organization_id: organization.id,
        tested_at: new Date().toISOString(),
      };

  try {
    const res = await fetch(task.webhook_url, {
      method: task.http_method ?? "POST",
      headers: {
        "Content-Type": "application/json",
        ...(task.headers ?? {}),
      },
      body: JSON.stringify(payload),
    });

    const updated = {
      ...task,
      last_triggered_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await saveAgentTask(updated);

    return Response.json({
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Webhook request failed" },
      { status: 502 }
    );
  }
}
