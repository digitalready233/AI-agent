import { readFile, stat } from "fs/promises";
import path from "path";

const KB_FILENAME = "company-knowledge.md";
const KB_RELATIVE = path.join("knowledge", KB_FILENAME);

let cachedKnowledge: string | null = null;
let cachedMtimeMs: number | null = null;

export interface KnowledgeSection {
  id: string;
  title: string;
  body: string;
  charCount: number;
}

export interface KnowledgeBaseStatus {
  loaded: boolean;
  path: string;
  charCount: number;
  sectionCount: number;
  sections: { title: string; charCount: number }[];
  lastModified?: string;
  missing: boolean;
}

function kbAbsolutePath(): string {
  return path.join(process.cwd(), KB_RELATIVE);
}

/** Split markdown on ## headings (same logic as orchestrator retrieval). */
export function parseKnowledgeSections(markdown: string): KnowledgeSection[] {
  const lines = markdown.split("\n");
  const sections: KnowledgeSection[] = [];
  let title = "Overview";
  let buf: string[] = [];

  const flush = () => {
    const body = buf.join("\n").trim();
    const id = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    sections.push({
      id: id || "overview",
      title,
      body: body || buf.join("\n"),
      charCount: (body || buf.join("\n")).length,
    });
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
  return sections;
}

export async function loadKnowledgeBase(): Promise<string> {
  const filePath = kbAbsolutePath();
  try {
    const fileStat = await stat(filePath);
    if (
      cachedKnowledge &&
      cachedMtimeMs !== null &&
      fileStat.mtimeMs === cachedMtimeMs
    ) {
      return cachedKnowledge;
    }
    cachedKnowledge = await readFile(filePath, "utf-8");
    cachedMtimeMs = fileStat.mtimeMs;
  } catch {
    cachedKnowledge =
      "Knowledge base file missing. Tell the customer you will connect them with the team for accurate details.";
    cachedMtimeMs = null;
  }
  return cachedKnowledge;
}

export function invalidateKnowledgeCache(): void {
  cachedKnowledge = null;
  cachedMtimeMs = null;
}

export async function getKnowledgeBaseStatus(): Promise<KnowledgeBaseStatus> {
  const filePath = kbAbsolutePath();
  try {
    const fileStat = await stat(filePath);
    const text = await loadKnowledgeBase();
    const sections = parseKnowledgeSections(text);
    return {
      loaded: true,
      path: filePath,
      charCount: text.length,
      sectionCount: sections.length,
      sections: sections.map((s) => ({
        title: s.title,
        charCount: s.charCount,
      })),
      lastModified: fileStat.mtime.toISOString(),
      missing: false,
    };
  } catch {
    return {
      loaded: false,
      path: filePath,
      charCount: 0,
      sectionCount: 0,
      sections: [],
      missing: true,
    };
  }
}
