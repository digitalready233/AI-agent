import { requireSession } from "@/lib/platform/auth";
import { listNotifications, markNotificationRead } from "@/lib/platform/data";

export async function GET() {
  const { organization } = await requireSession();
  const notifications = await listNotifications(organization.id);
  const unread = notifications.filter((n) => n.status !== "read").length;
  return Response.json({ notifications, unread });
}

export async function PATCH(req: Request) {
  const { organization } = await requireSession();
  const body = await req.json();
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) {
    return Response.json({ error: "Notification id required" }, { status: 400 });
  }
  await markNotificationRead(organization.id, id);
  return Response.json({ ok: true });
}
