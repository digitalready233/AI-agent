import { z } from "zod";
import { requireSession } from "@/lib/platform/auth";
import { listProfiles, saveProfile } from "@/lib/platform/data";
import {
  getOrganizationSettings,
  patchOrganizationSettingsSection,
} from "@/lib/platform/settings-data";
import { requirePermission } from "@/lib/platform/rbac";
import type { UserRole } from "@/lib/platform/types";

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum([
    "super_admin",
    "company_admin",
    "sales_manager",
    "sales_agent",
    "support_agent",
    "viewer",
  ]),
});

const roleSchema = z.object({
  profile_id: z.string().min(1),
  role: z.enum([
    "super_admin",
    "company_admin",
    "sales_manager",
    "sales_agent",
    "support_agent",
    "viewer",
  ]),
});

export async function GET() {
  const session = await requireSession();
  requirePermission(session, "team.view");
  const profiles = await listProfiles(session.organization.id);
  const settings = await getOrganizationSettings(session.organization.id);
  return Response.json({
    members: profiles,
    pending_invites: settings.team_settings.pending_invites,
  });
}

export async function POST(req: Request) {
  const session = await requireSession();
  requirePermission(session, "team.manage");

  const parsed = inviteSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const settings = await getOrganizationSettings(session.organization.id);
  const invite = {
    id: crypto.randomUUID(),
    email: parsed.data.email,
    role: parsed.data.role as UserRole,
    status: "pending" as const,
    created_at: new Date().toISOString(),
  };

  const updated = await patchOrganizationSettingsSection(
    session.organization.id,
    "team_settings",
    {
      pending_invites: [...settings.team_settings.pending_invites, invite],
    }
  );

  return Response.json({
    invite,
    message:
      "Invite recorded. Connect Supabase Auth email invites for production onboarding.",
    pending_invites: updated.team_settings.pending_invites,
  });
}

export async function PATCH(req: Request) {
  const session = await requireSession();
  requirePermission(session, "team.manage");

  const parsed = roleSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const profiles = await listProfiles(session.organization.id);
  const profile = profiles.find((p) => p.id === parsed.data.profile_id);
  if (!profile) {
    return Response.json({ error: "Member not found" }, { status: 404 });
  }

  const saved = await saveProfile({ ...profile, role: parsed.data.role });
  return Response.json({ profile: saved });
}
