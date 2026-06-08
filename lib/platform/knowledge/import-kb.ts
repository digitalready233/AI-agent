import { randomUUID } from "crypto";
import type { KnowledgeEntry } from "@/lib/platform/types";
import {
  buildReadybotPlaybookEntries,
  type ReadybotPlaybookRow,
} from "@/lib/platform/seed/readybot-large-kb";
import { isUuid } from "@/lib/platform/uuid";

/** Max rows per manual import (playbook seed uses bundled file separately). */
export const MAX_KB_IMPORT_ROWS = 500;

export type KnowledgeImportFormat = "entries" | "playbook";

export type NormalizedKnowledgeImportRow = {
  title: string;
  category: string;
  content: string;
};

function extractArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== "object") {
    throw new Error("JSON must be an array of entries or an object with an entries array.");
  }
  const o = raw as Record<string, unknown>;
  const nested =
    o.entries ?? o.knowledge ?? o.items ?? o.articles ?? o.data ?? o.records;
  if (Array.isArray(nested)) return nested;
  throw new Error(
    'Expected a JSON array or object with "entries", "knowledge", "items", or "articles".'
  );
}

function isPlaybookRow(item: unknown): item is ReadybotPlaybookRow {
  if (!item || typeof item !== "object") return false;
  const o = item as Record<string, unknown>;
  return (
    typeof o.intent === "string" &&
    typeof o.response === "string" &&
    typeof o.stage === "string" &&
    typeof o.pillar === "string" &&
    Array.isArray(o.keywords)
  );
}

function normalizePlaybookRow(item: unknown, index: number): ReadybotPlaybookRow {
  if (!isPlaybookRow(item)) {
    throw new Error(
      `Row ${index + 1}: playbook rows need id, intent, stage, pillar, keywords[], and response.`
    );
  }
  const id = String(item.id ?? `import_${index + 1}`).trim();
  return {
    id,
    intent: item.intent.trim(),
    stage: item.stage.trim(),
    pillar: item.pillar.trim(),
    keywords: item.keywords.map((k) => String(k).trim()).filter(Boolean),
    response: item.response.trim(),
  };
}

function normalizeEntryRow(item: unknown, index: number): NormalizedKnowledgeImportRow {
  if (!item || typeof item !== "object") {
    throw new Error(`Row ${index + 1}: expected an object.`);
  }
  const o = item as Record<string, unknown>;
  const title = String(o.title ?? o.name ?? o.question ?? "").trim();
  const content = String(
    o.content ?? o.body ?? o.text ?? o.answer ?? o.markdown ?? ""
  ).trim();
  const category = String(o.category ?? o.type ?? "general").trim() || "general";
  if (!title) {
    throw new Error(`Row ${index + 1}: title (or name/question) is required.`);
  }
  if (!content) {
    throw new Error(
      `Row ${index + 1}: content (or body/text/answer/markdown) is required.`
    );
  }
  return { title, category, content };
}

export function parseKnowledgeImportJson(raw: unknown): {
  format: KnowledgeImportFormat;
  total: number;
} & (
  | { format: "playbook"; rows: ReadybotPlaybookRow[] }
  | { format: "entries"; rows: NormalizedKnowledgeImportRow[] }
) {
  const arr = extractArray(raw);
  if (!arr.length) {
    throw new Error("Import file must contain at least one entry.");
  }
  if (arr.length > MAX_KB_IMPORT_ROWS) {
    throw new Error(
      `Import limited to ${MAX_KB_IMPORT_ROWS} entries per file. Split larger files.`
    );
  }

  if (isPlaybookRow(arr[0])) {
    const rows = arr.map((item, i) => normalizePlaybookRow(item, i));
    return { format: "playbook", rows, total: rows.length };
  }

  const rows = arr.map((item, i) => normalizeEntryRow(item, i));
  return { format: "entries", rows, total: rows.length };
}

export function buildKnowledgeEntriesFromImport(params: {
  format: KnowledgeImportFormat;
  rows: ReadybotPlaybookRow[] | NormalizedKnowledgeImportRow[];
  knowledgeBaseId: string;
  organizationId: string;
  now: string;
  existing?: KnowledgeEntry[];
}): KnowledgeEntry[] {
  const { knowledgeBaseId, organizationId, now, existing } = params;
  const existingByTitle = existing
    ? new Map(existing.map((e) => [e.title.trim(), e] as const))
    : null;

  if (params.format === "playbook") {
    return buildReadybotPlaybookEntries({
      knowledgeBaseId,
      organizationId,
      now,
      rows: params.rows as ReadybotPlaybookRow[],
      options: { matchExistingByTitle: existing },
    });
  }

  const base = {
    knowledge_base_id: knowledgeBaseId,
    organization_id: organizationId,
    status: "active" as const,
    created_at: now,
    updated_at: now,
  };

  return (params.rows as NormalizedKnowledgeImportRow[]).map((row) => {
    const prior = existingByTitle?.get(row.title.trim());
    const priorId = prior?.id && isUuid(prior.id) ? prior.id : undefined;
    return {
      ...base,
      id: priorId ?? randomUUID(),
      title: row.title,
      category: row.category,
      content: row.content,
      created_at: prior?.created_at ?? now,
    };
  });
}
