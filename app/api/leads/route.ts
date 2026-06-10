import { captureLead } from "@/lib/leads/capture";
import { checkAdminApiAuth } from "@/lib/security/admin-auth";
import { ensureLeadsHydrated, listLeads } from "@/lib/store";
import type { Channel, CustomerType, LeadStatus } from "@/lib/types";

export async function GET(req: Request) {
  if (!checkAdminApiAuth(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  await ensureLeadsHydrated();
  return Response.json({ leads: listLeads() });
}

export async function POST(req: Request) {
  await ensureLeadsHydrated();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const sessionId =
    typeof body.sessionId === "string" && body.sessionId.length > 0
      ? body.sessionId
      : `sess_${Date.now()}`;
  const channel = (body.channel as Channel) ?? "website";

  const email =
    typeof body.email === "string" && body.email.includes("@")
      ? body.email
      : undefined;

  if (!email && !body.phone && !body.fullName) {
    return Response.json(
      { error: "Provide at least name, phone, or email." },
      { status: 400 }
    );
  }

  const result = await captureLead({
    sessionId,
    channel,
    status: body.status as LeadStatus | undefined,
    customerType: body.customerType as CustomerType | undefined,
    fullName: typeof body.fullName === "string" ? body.fullName : undefined,
    phone: typeof body.phone === "string" ? body.phone : undefined,
    email,
    businessName:
      typeof body.businessName === "string" ? body.businessName : undefined,
    serviceNeeded:
      typeof body.serviceNeeded === "string" ? body.serviceNeeded : undefined,
    budgetRange:
      typeof body.budgetRange === "string" ? body.budgetRange : undefined,
    timeline: typeof body.timeline === "string" ? body.timeline : undefined,
    notes: typeof body.notes === "string" ? body.notes : undefined,
    source: "api",
  });

  return Response.json({
    success: true,
    created: result.created,
    lead: result.lead,
    crm: result.crm,
  });
}
