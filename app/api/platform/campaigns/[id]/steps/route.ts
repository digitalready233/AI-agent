import { z } from "zod";
import { requireSession } from "@/lib/platform/auth";
import {
  listCampaignSteps,
  replaceCampaignSteps,
} from "@/lib/platform/campaign-automation-data";
import type { CampaignStep, DelayUnit } from "@/lib/platform/campaign-types";
import { getCampaign } from "@/lib/platform/data";

const stepSchema = z.object({
  step_order: z.number().int().min(0),
  delay_amount: z.number().int().min(0),
  delay_unit: z.enum(["minutes", "hours", "days"]),
  message_template_id: z.string().uuid().optional().nullable(),
  message_body: z.string().optional().nullable(),
  action_after_send: z.string().optional().nullable(),
  stop_on_reply: z.boolean().optional(),
  mark_no_response: z.boolean().optional(),
});

const bodySchema = z.object({
  steps: z.array(stepSchema),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { organization } = await requireSession();
  const { id } = await params;
  const campaign = await getCampaign(id);
  if (!campaign || campaign.organization_id !== organization.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const steps = await listCampaignSteps(id);
  return Response.json({ steps });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { organization } = await requireSession();
  const { id } = await params;
  const campaign = await getCampaign(id);
  if (!campaign || campaign.organization_id !== organization.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const rows: Omit<CampaignStep, "created_at" | "updated_at">[] = parsed.data.steps.map(
    (s) => ({
      id: crypto.randomUUID(),
      campaign_id: id,
      organization_id: organization.id,
      step_order: s.step_order,
      delay_amount: s.delay_amount,
      delay_unit: s.delay_unit as DelayUnit,
      message_template_id: s.message_template_id ?? null,
      message_body: s.message_body ?? null,
      action_after_send: s.action_after_send ?? "wait_for_reply",
      stop_on_reply: s.stop_on_reply ?? true,
      mark_no_response: s.mark_no_response ?? false,
    })
  );

  const steps = await replaceCampaignSteps(id, organization.id, rows);
  return Response.json({ steps });
}
