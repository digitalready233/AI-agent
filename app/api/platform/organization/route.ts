import { z } from "zod";
import { requireSession } from "@/lib/platform/auth";
import { jsonStore } from "@/lib/platform/json-store";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { platformDb } from "@/lib/platform/db";
import { requirePermission } from "@/lib/platform/rbac";
import { isMissingSettingsSchemaError } from "@/lib/platform/settings-schema";
import type { Organization } from "@/lib/platform/types";

function coreOrgUpdate(org: Organization) {
  return {
    name: org.name,
    industry: org.industry,
    website: org.website,
    email: org.email,
    phone: org.phone,
    logo_url: org.logo_url,
    timezone: org.timezone,
  };
}

function fullOrgUpdate(org: Organization) {
  return {
    ...coreOrgUpdate(org),
    address: org.address,
    country: org.country,
    currency: org.currency,
    description: org.description,
    updated_at: org.updated_at,
  };
}

const schema = z.object({
  name: z.string().min(1),
  industry: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  logo_url: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  timezone: z.string().optional().nullable(),
  currency: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
});

export async function GET() {
  const session = await requireSession();
  requirePermission(session, "settings.view");
  return Response.json({ organization: session.organization });
}

export async function PUT(req: Request) {
  const session = await requireSession();
  requirePermission(session, "settings.manage");

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updated: Organization = {
    ...session.organization,
    ...parsed.data,
    industry: parsed.data.industry ?? null,
    website: parsed.data.website ?? null,
    email: parsed.data.email ?? null,
    phone: parsed.data.phone ?? null,
    logo_url: parsed.data.logo_url ?? null,
    address: parsed.data.address ?? null,
    country: parsed.data.country ?? null,
    currency: parsed.data.currency ?? null,
    description: parsed.data.description ?? null,
    timezone: parsed.data.timezone ?? session.organization.timezone,
    updated_at: new Date().toISOString(),
  };

  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    let { data, error } = await supabase
      .from("organizations")
      .update(fullOrgUpdate(updated))
      .eq("id", session.organization.id)
      .select()
      .single();

    if (error && isMissingSettingsSchemaError(error)) {
      ({ data, error } = await supabase
        .from("organizations")
        .update(coreOrgUpdate(updated))
        .eq("id", session.organization.id)
        .select()
        .single());
    }

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ organization: { ...updated, ...data } });
  }

  await jsonStore.setOrg(updated);
  return Response.json({ organization: updated });
}
