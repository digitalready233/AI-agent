import type { CustomerIntent } from "./types";

interface Section {
  title: string;
  body: string;
}

/** Split markdown on ## headings */
function splitIntoSections(markdown: string): Section[] {
  const lines = markdown.split("\n");
  const sections: Section[] = [];
  let title = "Overview";
  let buf: string[] = [];

  const flush = () => {
    const body = buf.join("\n").trim();
    if (body || sections.length === 0) {
      sections.push({ title, body: body || buf.join("\n") });
    }
    buf = [];
  };

  for (const line of lines) {
    const m = line.match(/^##+\s+(.+)/);
    if (m) {
      flush();
      title = m[1].trim();
    } else {
      buf.push(line);
    }
  }
  flush();
  return sections.filter((s) => s.body.length > 0);
}

const INTENT_KEYWORDS: Partial<Record<CustomerIntent, string[]>> = {
  sales_enquiry: ["service", "package", "social", "marketing", "website", "brand", "grow", "lead"],
  pricing_question: ["price", "cost", "how much", "budget", "fee", "quote", "ghs", "cedi", "payment"],
  booking_request: ["book", "schedule", "call", "meeting", "consultation", "calendar", "demo"],
  support_request: ["help", "issue", "problem", "how do i", "not working", "access"],
  complaint: ["unhappy", "refund", "disappointed", "complaint", "angry", "cancel", "terrible"],
};

function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
}

function scoreSection(
  section: Section,
  userTokens: Set<string>,
  intent: CustomerIntent
): number {
  const text = `${section.title} ${section.body}`.toLowerCase();
  let score = 0;
  for (const t of userTokens) {
    if (text.includes(t)) score += 2;
  }
  const titleTokens = tokenize(section.title);
  for (const t of userTokens) {
    if (titleTokens.has(t)) score += 4;
  }
  const extras = INTENT_KEYWORDS[intent] ?? [];
  for (const kw of extras) {
    if (text.includes(kw)) score += 1;
  }
  return score;
}

export interface RetrievedKnowledge {
  text: string;
  sectionTitles: string[];
}

/**
 * Lightweight KB “search”: rank markdown sections by overlap with the user message and intent.
 * No embeddings — good for medium-sized company-knowledge.md files.
 */
export function retrieveKnowledgeChunks(params: {
  fullMarkdown: string;
  userMessage: string;
  intent: CustomerIntent;
  maxSections?: number;
  maxChars?: number;
}): RetrievedKnowledge {
  const maxSections = params.maxSections ?? 4;
  const maxChars = params.maxChars ?? 12_000;

  const sections = splitIntoSections(params.fullMarkdown);
  if (sections.length === 0) {
    return { text: params.fullMarkdown, sectionTitles: ["(full document)"] };
  }

  const userTokens = tokenize(params.userMessage);
  const scored = sections
    .map((s, i) => ({
      s,
      score: scoreSection(s, userTokens, params.intent),
      i,
    }))
    .sort((a, b) => b.score - a.score || a.i - b.i);

  const picked =
    scored[0].score > 0
      ? scored.filter((x) => x.score > 0).slice(0, maxSections)
      : scored.slice(0, Math.min(2, scored.length));

  const parts: string[] = [];
  const titles: string[] = [];
  let total = 0;
  for (const { s } of picked) {
    const block = `## ${s.title}\n${s.body}`;
    if (total + block.length > maxChars) break;
    parts.push(block);
    titles.push(s.title);
    total += block.length;
  }

  const text = parts.join("\n\n---\n\n");
  return {
    text: text.length > 0 ? text : params.fullMarkdown.slice(0, maxChars),
    sectionTitles: titles.length ? titles : ["Overview"],
  };
}
