import { z } from "zod";
import { requireSession } from "@/lib/platform/auth";
import { requirePermission } from "@/lib/platform/rbac";
import { getDemoSession } from "@/lib/demo/demo-data";
import {
  canControlDemoPresentation,
  canShareDemoScreen,
} from "@/lib/demo/demo-presentation-permissions";
import { staffPresentationCommand } from "@/lib/demo/presentation-control";
import { PRESENTATION_CONTROL_MODES } from "@/lib/demo/types";

const bodySchema = z.object({
  command: z.enum([
    "set_control_mode",
    "select_path",
    "select_asset",
    "next_asset",
    "previous_asset",
    "show_booking_cta",
    "hide_booking_cta",
    "pause_ai",
    "resume_ai",
    "take_over",
    "return_to_ai",
    "screen_share_start",
    "screen_share_stop",
    "apply_pending_ai_action",
  ]),
  demo_path_id: z.string().uuid().optional(),
  demo_asset_id: z.string().uuid().optional(),
  control_mode: z.enum(PRESENTATION_CONTROL_MODES).optional(),
  notes: z.string().max(500).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireSession();
  requirePermission(ctx, "conversations.manage");
  const { id } = await params;

  const session = await getDemoSession(id);
  if (!session || session.organization_id !== ctx.organization.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  if (!canControlDemoPresentation(ctx, session)) {
    return Response.json({ error: "Presentation control not allowed" }, { status: 403 });
  }

  const body = bodySchema.parse(await req.json());

  if (
    (body.command === "screen_share_start" || body.command === "screen_share_stop") &&
    !canShareDemoScreen(ctx, session)
  ) {
    return Response.json({ error: "Screen share not allowed for your role" }, { status: 403 });
  }

  try {
    const updated = await staffPresentationCommand({
      ctx,
      demoSessionId: id,
      command: body.command,
      demoPathId: body.demo_path_id,
      demoAssetId: body.demo_asset_id,
      controlMode: body.control_mode,
      notes: body.notes,
    });

    const pending = updated.metadata?.pending_presentation_action;

    return Response.json({
      ok: true,
      session: updated,
      pending_ai_action: pending ?? null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Presentation command failed";
    return Response.json({ error: message }, { status: 400 });
  }
}
