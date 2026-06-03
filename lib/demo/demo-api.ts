import { hasServiceRoleKey, withPlatformAdmin } from "@/lib/platform/db";

export function demoApiUnavailable() {
  return Response.json({ error: "Demo API not configured." }, { status: 503 });
}

export async function withDemoPublicApi<T>(
  handler: () => Promise<{ status: number; body: Record<string, unknown> }>
): Promise<Response> {
  if (!hasServiceRoleKey()) return demoApiUnavailable();
  return withPlatformAdmin(async () => {
    const result = await handler();
    return Response.json(result.body, { status: result.status });
  });
}
