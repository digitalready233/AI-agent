/** True when Supabase is missing settings tables/columns (migration 004 not applied). */
export function isMissingSettingsSchemaError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; message?: string };
  const msg = e.message ?? "";
  return (
    e.code === "PGRST205" ||
    e.code === "42P01" ||
    e.code === "PGRST204" ||
    msg.includes("organization_settings") ||
    msg.includes("organization_secrets") ||
    msg.includes("schema cache")
  );
}

export const SETTINGS_MIGRATION_HINT =
  "Run supabase/migrations/004_organization_settings.sql in your Supabase SQL Editor, then reload.";
