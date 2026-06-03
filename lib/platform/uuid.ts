import { randomUUID } from "crypto";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

/** Use for Postgres rows; generates a new id when the value is not a UUID (e.g. ke-dr-profile). */
export function knowledgeEntryIdForStorage(
  id: string | undefined | null,
  options?: { generateIfInvalid?: boolean }
): string {
  const trimmed = id?.trim() ?? "";
  if (isUuid(trimmed)) return trimmed;
  if (options?.generateIfInvalid !== false) return randomUUID();
  return trimmed;
}
