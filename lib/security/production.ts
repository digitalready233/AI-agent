export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

/** In production, missing secrets must deny access — never fail open. */
export function secretConfigured(name: string, value: string | null | undefined): boolean {
  const trimmed = value?.trim();
  if (trimmed) return true;
  if (isProductionRuntime()) {
    console.error(`[security] ${name} is required in production`);
  }
  return false;
}
