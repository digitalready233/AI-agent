import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/platform/auth";
import { assertCanCreateAgent } from "@/lib/billing/access";
import { can } from "@/lib/platform/rbac";
import {
  agentFieldsSchema,
  formatAgentApiValidationError,
} from "@/lib/platform/agent-api-schema";
import {
  deleteAgent,
  getAgent,
  linkAgentKnowledgeBases,
  listAgents,
  saveAgent,
} from "@/lib/platform/data";
import type { Agent } from "@/lib/platform/types";

export async function GET() {
  const { organization } = await requireSession();
  const agents = await listAgents(organization.id);
  return Response.json({ agents });
}

export async function POST(req: Request) {
  const { organization, profile } = await requireSession();
  const parsed = agentFieldsSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: formatAgentApiValidationError(parsed.error) },
      { status: 400 }
    );
  }

  const d = parsed.data;
  try {
    await assertCanCreateAgent(organization.id, profile.role);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Agent limit reached" },
      { status: 403 }
    );
  }

  const now = new Date().toISOString();
  const agent: Agent = {
    id: crypto.randomUUID(),
    organization_id: organization.id,
    name: d.name,
    nickname: d.nickname ?? null,
    company_product_name: d.company_product_name ?? organization.name,
    agent_type: d.agent_type,
    operational_role: d.operational_role ?? "general_sales",
    position: d.position ?? null,
    language: d.language ?? "en",
    tone: d.tone ?? "professional",
    timezone: d.timezone ?? organization.timezone ?? "Africa/Accra",
    voice: d.voice ?? "alloy",
    voice_speed: d.voice_speed ?? 1,
    welcome_message: d.welcome_message ?? null,
    system_prompt: d.system_prompt ?? null,
    qualification_prompt: d.qualification_prompt ?? null,
    objection_prompt: d.objection_prompt ?? null,
    handoff_rules: d.handoff_rules ?? null,
    booking_rules: d.booking_rules ?? null,
    crm_update_rules: d.crm_update_rules ?? null,
    lead_scoring_rules: d.lead_scoring_rules ?? null,
    fallback_response: d.fallback_response ?? null,
    channels: d.channels ?? ["website"],
    status: d.status ?? "draft",
    enabled: d.enabled ?? true,
    presenter_config: d.presenter_config ?? {},
    avatar_provider: d.avatar_provider ?? "internal_card",
    avatar_id: d.avatar_id ?? null,
    avatar_replica_id: d.avatar_replica_id ?? null,
    avatar_persona_id: d.avatar_persona_id ?? null,
    avatar_voice_id: d.avatar_voice_id ?? null,
    avatar_style: d.avatar_style ?? null,
    avatar_enabled: d.avatar_enabled ?? false,
    avatar_fallback_mode: d.avatar_fallback_mode ?? "internal_card",
    avatar_provider_mode: d.avatar_provider_mode ?? "org_default",
    avatar_preferred_provider: d.avatar_preferred_provider ?? null,
    avatar_allow_auto_switch: d.avatar_allow_auto_switch ?? true,
    created_at: now,
    updated_at: now,
  };

  try {
    const saved = await saveAgent(agent);
    await linkAgentKnowledgeBases(
      saved.id,
      d.knowledge_base_ids ?? [],
      organization.id
    );
    revalidatePath("/dashboard/agents");
    return Response.json({ agent: saved }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/platform/agents]", err);
    const message =
      err instanceof Error ? err.message : "Failed to create agent";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const { organization } = await requireSession();
  const parsed = agentFieldsSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: formatAgentApiValidationError(parsed.error) },
      { status: 400 }
    );
  }

  const d = parsed.data;
  if (!d.id) {
    return Response.json({ error: "Agent id required" }, { status: 400 });
  }

  const existing = await getAgent(d.id);
  if (!existing || existing.organization_id !== organization.id) {
    return Response.json({ error: "Agent not found" }, { status: 404 });
  }

  const agent: Agent = {
    ...existing,
    name: d.name,
    nickname: d.nickname ?? null,
    company_product_name: d.company_product_name ?? organization.name,
    agent_type: d.agent_type,
    operational_role: d.operational_role ?? "general_sales",
    position: d.position ?? null,
    language: d.language ?? "en",
    tone: d.tone ?? "professional",
    timezone: d.timezone ?? organization.timezone ?? "Africa/Accra",
    voice: d.voice ?? "alloy",
    voice_speed: d.voice_speed ?? 1,
    welcome_message: d.welcome_message ?? null,
    system_prompt: d.system_prompt ?? null,
    qualification_prompt: d.qualification_prompt ?? null,
    objection_prompt: d.objection_prompt ?? null,
    handoff_rules: d.handoff_rules ?? null,
    booking_rules: d.booking_rules ?? null,
    crm_update_rules: d.crm_update_rules ?? null,
    lead_scoring_rules: d.lead_scoring_rules ?? null,
    fallback_response: d.fallback_response ?? null,
    channels: d.channels ?? ["website"],
    status: d.status ?? existing.status,
    enabled: d.enabled ?? existing.enabled,
    presenter_config:
      d.presenter_config !== undefined ? d.presenter_config : existing.presenter_config ?? {},
    avatar_provider: d.avatar_provider ?? existing.avatar_provider ?? "internal_card",
    avatar_id: d.avatar_id !== undefined ? d.avatar_id : existing.avatar_id,
    avatar_replica_id:
      d.avatar_replica_id !== undefined ? d.avatar_replica_id : existing.avatar_replica_id,
    avatar_persona_id:
      d.avatar_persona_id !== undefined ? d.avatar_persona_id : existing.avatar_persona_id,
    avatar_voice_id:
      d.avatar_voice_id !== undefined ? d.avatar_voice_id : existing.avatar_voice_id,
    avatar_style: d.avatar_style !== undefined ? d.avatar_style : existing.avatar_style,
    avatar_enabled: d.avatar_enabled ?? existing.avatar_enabled ?? false,
    avatar_fallback_mode:
      d.avatar_fallback_mode ?? existing.avatar_fallback_mode ?? "internal_card",
    avatar_provider_mode:
      d.avatar_provider_mode ?? existing.avatar_provider_mode ?? "org_default",
    avatar_preferred_provider:
      d.avatar_preferred_provider !== undefined
        ? d.avatar_preferred_provider
        : existing.avatar_preferred_provider,
    avatar_allow_auto_switch:
      d.avatar_allow_auto_switch ?? existing.avatar_allow_auto_switch ?? true,
    updated_at: new Date().toISOString(),
  };

  try {
    const saved = await saveAgent(agent);
    await linkAgentKnowledgeBases(
      saved.id,
      d.knowledge_base_ids ?? [],
      organization.id
    );
    revalidatePath("/dashboard/agents");
    revalidatePath(`/dashboard/agents/${saved.id}`);
    return Response.json({ agent: saved });
  } catch (err) {
    console.error("[PUT /api/platform/agents]", err);
    const message =
      err instanceof Error ? err.message : "Failed to update agent";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await requireSession();
  if (!can(session.profile.role, "agents.manage")) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { organization } = session;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id")?.trim();
  if (!id) {
    return Response.json({ error: "Agent id required" }, { status: 400 });
  }

  const existing = await getAgent(id);
  if (!existing || existing.organization_id !== organization.id) {
    return Response.json({ error: "Agent not found" }, { status: 404 });
  }

  const deleted = await deleteAgent(id, organization.id);
  if (!deleted) {
    return Response.json({ error: "Agent could not be deleted" }, { status: 500 });
  }

  revalidatePath("/dashboard/agents");
  revalidatePath(`/dashboard/agents/${id}`);

  return Response.json({ ok: true, deleted: true });
}
