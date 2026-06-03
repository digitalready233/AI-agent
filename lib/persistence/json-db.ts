import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");

async function ensureParentDir(filePath: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
}

export function dataPath(filename: string): string {
  return path.join(DATA_DIR, filename);
}

export async function readJsonFile<T>(filename: string, fallback: T): Promise<T> {
  const filePath = dataPath(filename);
  try {
    const raw = await readFile(filePath, "utf-8");
    if (!raw.trim()) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function writeJsonFile<T>(filename: string, data: T): Promise<void> {
  const filePath = dataPath(filename);
  await ensureParentDir(filePath);
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
}
