import { getCalendlyAccessToken } from "./credentials";

const API_BASE = "https://api.calendly.com";

export async function testCalendlyConnection(organizationId: string): Promise<{
  ok: boolean;
  userUri?: string;
  schedulingUrl?: string;
  email?: string;
  error?: string;
}> {
  const token = await getCalendlyAccessToken(organizationId);
  if (!token) {
    return { ok: false, error: "Calendly personal access token not configured." };
  }

  try {
    const res = await fetch(`${API_BASE}/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = (await res.json()) as {
      resource?: {
        uri?: string;
        scheduling_url?: string;
        email?: string;
        name?: string;
      };
      message?: string;
      title?: string;
    };

    if (!res.ok) {
      return {
        ok: false,
        error: data.message ?? data.title ?? `Calendly API error (${res.status})`,
      };
    }

    return {
      ok: true,
      userUri: data.resource?.uri,
      schedulingUrl: data.resource?.scheduling_url,
      email: data.resource?.email,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

export function buildCalendlyEmbedUrl(params: {
  schedulingUrl: string;
  name?: string | null;
  email?: string | null;
  conversationId?: string | null;
  leadId?: string | null;
}): string {
  const url = new URL(params.schedulingUrl);
  if (params.name) url.searchParams.set("name", params.name);
  if (params.email) url.searchParams.set("email", params.email);
  if (params.conversationId) {
    url.searchParams.set("utm_content", params.conversationId);
  }
  if (params.leadId) {
    url.searchParams.set("utm_campaign", params.leadId);
  }
  return url.toString();
}
