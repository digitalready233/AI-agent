import type { KnowledgeEntry } from "@/lib/platform/types";
import { READYBOT_PLAYBOOK_CATEGORY } from "@/lib/platform/seed/readybot-large-kb";
import type { ReadybotPipelineStep } from "@/lib/platform/workflow/readybot-stage-engine";

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s/]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

/** Map workflow / pipeline step to playbook JSON stage labels. */
export function playbookStageHint(params: {
  workflowStage?: string | null;
  readybotStep?: ReadybotPipelineStep | null;
}): string | null {
  const step = params.readybotStep;
  if (step === "discovery") return "Discovery";
  if (step === "stack") return "Stack";
  if (step === "team") return "Team";
  if (step === "budget_timing") return "Budget";
  if (step === "close") return "Close";

  const ws = params.workflowStage?.toLowerCase();
  if (ws === "discovery") return "Discovery";
  if (ws === "qualification") return "Stack";
  if (ws === "booking" || ws === "close") return "Close";
  if (ws === "objection_handling") return "Objection";
  return null;
}

function parseKeywords(content: string): string[] {
  const line = content
    .split("\n")
    .find((l) => l.startsWith("Keywords:"));
  if (!line) return [];
  return line
    .replace(/^Keywords:\s*/i, "")
    .split(",")
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);
}

function parseStageFromContent(content: string): string | null {
  const line = content.split("\n").find((l) => l.startsWith("Stage:"));
  return line ? line.replace(/^Stage:\s*/i, "").trim() : null;
}

function parseResponseScript(content: string): string {
  const marker = "Approved response";
  const idx = content.indexOf(marker);
  if (idx < 0) return content.trim();
  return content.slice(idx).replace(/^Approved response[^:]*:\s*/i, "").trim();
}

function scorePlaybookEntry(
  entry: KnowledgeEntry,
  userTokens: string[],
  stageHint: string | null
): number {
  const content = entry.content;
  const stage = parseStageFromContent(content);
  const keywords = parseKeywords(content);
  let score = 0;

  if (stageHint && stage && stage.toLowerCase() === stageHint.toLowerCase()) {
    score += 12;
  }

  for (const kw of keywords) {
    const parts = kw.split(/\s+/);
    if (parts.every((p) => userTokens.includes(p))) score += 8;
    else if (parts.some((p) => userTokens.includes(p))) score += 4;
  }

  const body = content.toLowerCase();
  for (const t of userTokens) {
    if (body.includes(t)) score += 1;
  }

  const pillar = content.match(/^Pillar:\s*(.+)$/m)?.[1]?.toLowerCase() ?? "";
  if (pillar.includes("ads") && userTokens.some((t) => ["ads", "paid", "meta", "google", "campaign"].includes(t))) {
    score += 3;
  }
  if (pillar.includes("social") && userTokens.some((t) => ["social", "instagram", "followers", "brand"].includes(t))) {
    score += 3;
  }
  if ((pillar.includes("web") || pillar.includes("ops")) && userTokens.some((t) => ["web", "crm", "analytics", "website"].includes(t))) {
    score += 3;
  }

  return score;
}

export function retrieveReadybotPlaybookContext(
  entries: KnowledgeEntry[],
  userMessage: string,
  options?: {
    workflowStage?: string | null;
    readybotStep?: ReadybotPipelineStep | null;
    limit?: number;
  }
): string {
  const playbook = entries.filter((e) => e.category === READYBOT_PLAYBOOK_CATEGORY);
  if (!playbook.length || !userMessage.trim()) return "";

  const userTokens = tokenize(userMessage);
  const stageHint = playbookStageHint({
    workflowStage: options?.workflowStage,
    readybotStep: options?.readybotStep,
  });
  const limit = options?.limit ?? 6;

  const ranked = playbook
    .map((entry) => ({
      entry,
      score: scorePlaybookEntry(entry, userTokens, stageHint),
    }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);

  const picked =
    ranked.length > 0
      ? ranked.slice(0, limit)
      : stageHint
        ? playbook
            .filter((e) => parseStageFromContent(e.content) === stageHint)
            .slice(0, 3)
            .map((entry) => ({ entry, score: 1 }))
        : playbook.slice(0, 3).map((entry) => ({ entry, score: 0 }));

  if (!picked.length) return "";

  const blocks = picked.map(({ entry }) => {
    const script = parseResponseScript(entry.content);
    const stage = parseStageFromContent(entry.content);
    return `#### ${entry.title}${stage ? ` [${stage}]` : ""}\n${script}`;
  });

  return [
    "## ReadyBot playbook snippets (use tone and facts; obey pipeline — one question per turn)",
    blocks.join("\n\n"),
  ].join("\n");
}

export function formatCoreKnowledgeEntries(entries: KnowledgeEntry[]): string {
  return entries
    .map((e) => `### ${e.title} (${e.category})\n${e.content}`)
    .join("\n\n");
}

export function partitionKnowledgeEntries(entries: KnowledgeEntry[]): {
  playbook: KnowledgeEntry[];
  core: KnowledgeEntry[];
} {
  const playbook = entries.filter((e) => e.category === READYBOT_PLAYBOOK_CATEGORY);
  const core = entries.filter((e) => e.category !== READYBOT_PLAYBOOK_CATEGORY);
  return { playbook, core };
}
