import { readFileSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import type { KnowledgeEntry } from "@/lib/platform/types";
import { isUuid } from "@/lib/platform/uuid";

/** Category used for staged playbook rows (keyword retrieval). */
export const READYBOT_PLAYBOOK_CATEGORY = "ReadyBot Playbook";

export type ReadybotPlaybookRow = {
  id: string;
  intent: string;
  stage: string;
  pillar: string;
  keywords: string[];
  response: string;
};

export function playbookEntryTitle(row: ReadybotPlaybookRow): string {
  return `${row.stage} · ${row.intent} (${row.id})`;
}

export function playbookEntryContent(row: ReadybotPlaybookRow): string {
  return [
    `Intent: ${row.intent}`,
    `Stage: ${row.stage}`,
    `Pillar: ${row.pillar}`,
    `Keywords: ${row.keywords.join(", ")}`,
    "",
    "Approved response (one question per turn; do not combine steps):",
    row.response,
  ].join("\n");
}

export function loadReadybotLargeKbJson(): ReadybotPlaybookRow[] {
  const path = join(
    process.cwd(),
    "lib",
    "platform",
    "seed",
    "data",
    "readybot-large-kb.json"
  );
  const raw = readFileSync(path, "utf8");
  const parsed = JSON.parse(raw) as ReadybotPlaybookRow[];
  if (!Array.isArray(parsed)) {
    throw new Error("readybot-large-kb.json must be a JSON array");
  }
  return parsed;
}

export function buildReadybotPlaybookEntries(params: {
  knowledgeBaseId: string;
  organizationId: string;
  now: string;
  rows?: ReadybotPlaybookRow[];
  options?: { matchExistingByTitle?: KnowledgeEntry[] };
}): KnowledgeEntry[] {
  const { knowledgeBaseId, organizationId, now } = params;
  const rows = params.rows ?? loadReadybotLargeKbJson();
  const base = {
    knowledge_base_id: knowledgeBaseId,
    organization_id: organizationId,
    status: "active" as const,
    category: READYBOT_PLAYBOOK_CATEGORY,
    created_at: now,
    updated_at: now,
  };

  const existingByTitle = params.options?.matchExistingByTitle
    ? new Map(
        params.options.matchExistingByTitle.map((e) => [e.title.trim(), e] as const)
      )
    : null;

  return rows.map((row) => {
    const title = playbookEntryTitle(row);
    const prior = existingByTitle?.get(title.trim());
    const priorId = prior?.id && isUuid(prior.id) ? prior.id : undefined;
    const id = priorId ?? randomUUID();

    return {
      ...base,
      id,
      title,
      content: playbookEntryContent(row),
      created_at: prior?.created_at ?? now,
    };
  });
}
