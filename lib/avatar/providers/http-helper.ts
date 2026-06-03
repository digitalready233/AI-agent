import { AvatarProviderError } from "../errors";

export async function avatarProviderFetch(
  url: string,
  init: RequestInit & { provider: string; timeoutMs?: number }
): Promise<Response> {
  const timeoutMs = init.timeoutMs ?? 25_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (res.status === 429) {
      throw new AvatarProviderError(
        "RATE_LIMIT",
        `${init.provider} rate limit exceeded`,
        { provider: init.provider, statusCode: 429 }
      );
    }
    return res;
  } catch (err) {
    if (err instanceof AvatarProviderError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new AvatarProviderError("TIMEOUT", `${init.provider} request timed out`, {
        provider: init.provider,
      });
    }
    throw new AvatarProviderError(
      "PROVIDER_API_ERROR",
      err instanceof Error ? err.message : "Network error",
      { provider: init.provider }
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function parseJsonOrThrow(
  res: Response,
  provider: string
): Promise<Record<string, unknown>> {
  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const msg =
      (typeof data.message === "string" && data.message) ||
      (typeof data.error === "string" && data.error) ||
      `HTTP ${res.status}`;
    throw new AvatarProviderError("PROVIDER_API_ERROR", msg, {
      provider,
      statusCode: res.status,
    });
  }
  return data;
}
