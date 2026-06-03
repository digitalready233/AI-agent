import { z } from "zod";
import { getLead, saveLead } from "@/lib/platform/data";
import { hasServiceRoleKey, withPlatformAdmin } from "@/lib/platform/db";
import { getDemoSession, saveDemoSession } from "@/lib/demo/demo-data";

const bodySchema = z.object({
  full_name: z.string().min(1).max(120),
  email: z.string().email().optional(),
  phone: z.string().max(40).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  if (!hasServiceRoleKey()) {
    return Response.json({ error: "Demo room not configured." }, { status: 503 });
  }

  const { sessionId } = await params;
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  return withPlatformAdmin(async () => {
    const session = await getDemoSession(sessionId);
    if (!session) {
      return Response.json({ error: "Demo not found" }, { status: 404 });
    }
    if (session.lead_id) {
      const existing = await getLead(session.lead_id);
      if (existing) {
        return Response.json({
          lead: {
            id: existing.id,
            full_name: existing.full_name,
            email: existing.email,
            phone: existing.phone,
          },
        });
      }
    }

    const now = new Date().toISOString();
    const lead = await saveLead({
      id: crypto.randomUUID(),
      organization_id: session.organization_id,
      full_name: parsed.data.full_name.trim(),
      email: parsed.data.email ?? null,
      phone: parsed.data.phone ?? null,
      source: "demo_room",
      lead_status: "created",
      lead_category: null,
      service_interest: null,
      budget: null,
      timeline: null,
      notes: `Captured during demo ${sessionId}`,
      summary: null,
      next_action: null,
      created_at: now,
      updated_at: now,
    });

    await saveDemoSession({
      ...session,
      lead_id: lead.id,
      metadata: {
        ...(session.metadata ?? {}),
        lead_captured_in_room: true,
      },
    });

    return Response.json({
      lead: {
        id: lead.id,
        full_name: lead.full_name,
        email: lead.email,
        phone: lead.phone,
        service_interest: lead.service_interest,
        lead_category: lead.lead_category,
        budget: lead.budget,
        timeline: lead.timeline,
      },
    });
  });
}
