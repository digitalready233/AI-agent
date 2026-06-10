import { createHmac, timingSafeEqual } from "node:crypto";

const HEADER = "x-visitor-token";

function visitorSecret(): string {
  const explicit = process.env.VISITOR_SESSION_SECRET?.trim();
  if (explicit) return explicit;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (service) {
    return createHmac("sha256", "digisales-visitor-v1").update(service).digest("hex");
  }
  return "digisales-visitor-dev-only";
}

function signPayload(payload: string): string {
  return createHmac("sha256", visitorSecret()).update(payload).digest("base64url");
}

/** Mint a signed visitor token bound to session + agent. */
export function mintVisitorSessionToken(sessionId: string, agentId: string): string {
  const payload = `${sessionId}:${agentId}`;
  const sig = signPayload(payload);
  return `${Buffer.from(payload, "utf8").toString("base64url")}.${sig}`;
}

export function verifyVisitorSessionToken(
  token: string | null | undefined,
  sessionId: string,
  agentId: string
): boolean {
  if (!token?.trim()) return false;
  const parts = token.trim().split(".");
  if (parts.length !== 2) return false;

  const [encoded, sig] = parts;
  let payload: string;
  try {
    payload = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return false;
  }

  const expectedPayload = `${sessionId}:${agentId}`;
  if (payload !== expectedPayload) return false;

  const expectedSig = signPayload(payload);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function visitorTokenFromRequest(req: Request): string | null {
  const fromQuery = new URL(req.url).searchParams.get("visitorToken")?.trim();
  return (
    req.headers.get(HEADER)?.trim() ||
    fromQuery ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    null
  );
}

export const VISITOR_TOKEN_HEADER = HEADER;
