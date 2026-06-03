import { z } from "zod";
import { requireSession } from "@/lib/platform/auth";
import { deleteLead, getLead, listLeads, saveLead } from "@/lib/platform/data";
import type { Lead, LeadCategory, LeadStatus } from "@/lib/platform/types";

const leadSchema = z.object({
  id: z.string().optional(),
  full_name: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  business_name: z.string().optional(),
  service_interest: z.string().optional(),
  budget: z.string().optional(),
  timeline: z.string().optional(),
  source: z.string().optional(),
  lead_score: z.number().optional(),
  lead_category: z
    .enum(["hot", "warm", "cold", "support", "not_qualified"])
    .optional(),
  lead_status: z
    .enum([
      "created",
      "open",
      "working",
      "qualified",
      "disqualified",
      "opportunity_created",
      "opportunity_lost",
      "customer",
    ])
    .optional(),
  assigned_to: z.string().optional().nullable(),
  summary: z.string().optional(),
  next_action: z.string().optional(),
  follow_up_date: z.string().optional().nullable(),
  notes: z.string().optional(),
  do_not_call: z.boolean().optional(),
});

export async function GET() {
  const { organization } = await requireSession();
  const leads = await listLeads(organization.id);
  return Response.json({ leads });
}

export async function POST(req: Request) {
  const { organization } = await requireSession();
  const parsed = leadSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const now = new Date().toISOString();
  const d = parsed.data;
  const lead: Lead = {
    id: crypto.randomUUID(),
    organization_id: organization.id,
    full_name: d.full_name ?? null,
    email: d.email || null,
    phone: d.phone ?? null,
    business_name: d.business_name ?? null,
    service_interest: d.service_interest ?? null,
    budget: d.budget ?? null,
    timeline: d.timeline ?? null,
    source: d.source ?? "website",
    lead_score: d.lead_score ?? 0,
    lead_category: (d.lead_category as LeadCategory) ?? "warm",
    lead_status: (d.lead_status as LeadStatus) ?? "created",
    assigned_to: d.assigned_to ?? null,
    summary: d.summary ?? null,
    next_action: d.next_action ?? null,
    follow_up_date: d.follow_up_date ?? null,
    notes: d.notes ?? null,
    do_not_call: d.do_not_call ?? false,
    do_not_call_at: d.do_not_call ? now : null,
    marketing_opt_in: d.do_not_call ? false : true,
    created_at: now,
    updated_at: now,
  };

  const saved = await saveLead(lead);
  return Response.json({ lead: saved }, { status: 201 });
}

export async function PUT(req: Request) {
  const { organization } = await requireSession();
  const parsed = leadSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;
  if (!d.id) {
    return Response.json({ error: "Lead id required" }, { status: 400 });
  }

  const existing = await getLead(d.id);
  if (!existing || existing.organization_id !== organization.id) {
    return Response.json({ error: "Lead not found" }, { status: 404 });
  }

  const lead: Lead = {
    ...existing,
    full_name: d.full_name ?? existing.full_name,
    email: d.email !== undefined ? d.email || null : existing.email,
    phone: d.phone ?? existing.phone,
    business_name: d.business_name ?? existing.business_name,
    service_interest: d.service_interest ?? existing.service_interest,
    budget: d.budget ?? existing.budget,
    timeline: d.timeline ?? existing.timeline,
    source: d.source ?? existing.source,
    lead_score: d.lead_score ?? existing.lead_score,
    lead_category: (d.lead_category as LeadCategory) ?? existing.lead_category,
    lead_status: (d.lead_status as LeadStatus) ?? existing.lead_status,
    assigned_to: d.assigned_to !== undefined ? d.assigned_to : existing.assigned_to,
    summary: d.summary ?? existing.summary,
    next_action: d.next_action ?? existing.next_action,
    follow_up_date:
      d.follow_up_date !== undefined ? d.follow_up_date : existing.follow_up_date,
    notes: d.notes ?? existing.notes,
    updated_at: new Date().toISOString(),
  };

  if (d.do_not_call !== undefined) {
    const now = new Date().toISOString();
    lead.do_not_call = d.do_not_call;
    if (d.do_not_call) {
      lead.do_not_call_at = existing.do_not_call_at ?? now;
      lead.marketing_opt_in = false;
    } else {
      lead.do_not_call_at = null;
    }
  }

  const saved = await saveLead(lead);
  return Response.json({ lead: saved });
}

export async function DELETE(req: Request) {
  const { organization } = await requireSession();
  const id = new URL(req.url).searchParams.get("id")?.trim();
  if (!id) {
    return Response.json({ error: "Lead id required" }, { status: 400 });
  }

  const existing = await getLead(id);
  if (!existing || existing.organization_id !== organization.id) {
    return Response.json({ error: "Lead not found" }, { status: 404 });
  }

  await deleteLead(id);
  return Response.json({ ok: true });
}
