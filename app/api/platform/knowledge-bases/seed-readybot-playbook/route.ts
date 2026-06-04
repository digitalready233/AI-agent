import { requireSession } from "@/lib/platform/auth";
import {
  getAgent,
  getAgentKnowledgeBaseIds,
  linkAgentKnowledgeBases,
  listKnowledgeBases,
  listKnowledgeEntries,
  saveKnowledgeEntry,
} from "@/lib/platform/data";
import {
  buildReadybotPlaybookEntries,
  READYBOT_PLAYBOOK_CATEGORY,
} from "@/lib/platform/seed/readybot-large-kb";
import { can } from "@/lib/platform/rbac";
import { isUuid, knowledgeEntryIdForStorage } from "@/lib/platform/uuid";

/** Import ReadyBot_Large_KB.json (200 staged scripts) into the org knowledge base. */
export async function POST(req: Request) {
  const session = await requireSession();
  if (!can(session.profile.role, "knowledge.manage")) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    knowledgeBaseId?: string;
    agentId?: string;
    linkToAgent?: boolean;
    overwrite?: boolean;
  };
  const overwrite = body.overwrite === true;

  const orgId = session.organization.id;
  const bases = await listKnowledgeBases(orgId);
  const kbId =
    body.knowledgeBaseId?.trim() ||
    bases.find((b) => b.status === "active")?.id ||
    bases[0]?.id;

  if (!kbId) {
    return Response.json(
      { error: "No knowledge base found. Create one first." },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const existing = await listKnowledgeEntries(orgId, kbId);
  const seedEntries = buildReadybotPlaybookEntries({
    knowledgeBaseId: kbId,
    organizationId: orgId,
    now,
    options: { matchExistingByTitle: existing },
  });
  const byTitle = new Map(existing.map((e) => [e.title.trim(), e]));

  const saved: string[] = [];
  const skipped: string[] = [];
  for (const entry of seedEntries) {
    const prior = byTitle.get(entry.title.trim());
    if (prior && !overwrite) {
      skipped.push(entry.title);
      continue;
    }
    const id = prior && isUuid(prior.id) ? prior.id : knowledgeEntryIdForStorage(entry.id);
    const row = prior
      ? { ...prior, ...entry, id, created_at: prior.created_at, updated_at: now }
      : { ...entry, id };
    const stored = await saveKnowledgeEntry(row);
    saved.push(stored.title);
  }

  let linkedAgentId: string | null = null;
  const linkAgentId =
    body.agentId?.trim() ||
    (body.linkToAgent !== false
      ? process.env.NEXT_PUBLIC_PLATFORM_AGENT_ID?.trim()
      : undefined);

  if (linkAgentId) {
    const agent = await getAgent(linkAgentId);
    if (agent && agent.organization_id === orgId) {
      const current = await getAgentKnowledgeBaseIds(linkAgentId);
      if (!current.includes(kbId)) {
        await linkAgentKnowledgeBases(linkAgentId, [...current, kbId], orgId);
      }
      linkedAgentId = linkAgentId;
    }
  }

  return Response.json({
    knowledgeBaseId: kbId,
    category: READYBOT_PLAYBOOK_CATEGORY,
    created: saved.length,
    skipped: skipped.length,
    totalPlaybookRows: seedEntries.length,
    linkedAgentId,
  });
}
