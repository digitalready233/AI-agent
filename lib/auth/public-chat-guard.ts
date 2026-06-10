import { checkRateLimit, clientIpFromRequest } from "@/lib/security/rate-limit";
import {
  mintVisitorSessionToken,
  verifyVisitorSessionToken,
  visitorTokenFromRequest,
} from "@/lib/auth/visitor-session";

export class PublicChatGuardError extends Error {
  status: number;
  retryAfterSec?: number;

  constructor(message: string, status: number, retryAfterSec?: number) {
    super(message);
    this.status = status;
    this.retryAfterSec = retryAfterSec;
  }
}

function rateLimitPerMinute(): number {
  const n = Number(process.env.PUBLIC_CHAT_RATE_LIMIT_PER_MIN ?? "40");
  return Number.isFinite(n) && n > 0 ? n : 40;
}

/** When set, only this agent UUID is accepted on public chat APIs. */
export function resolveAllowedPublicAgentId(requested: string): string {
  const trimmed = requested?.trim();
  const allowlisted =
    process.env.PLATFORM_AGENT_ID?.trim() ||
    process.env.NEXT_PUBLIC_PLATFORM_AGENT_ID?.trim() ||
    "";

  if (allowlisted) {
    if (!trimmed || trimmed !== allowlisted) {
      throw new PublicChatGuardError("This agent is not available for public chat.", 403);
    }
    return allowlisted;
  }

  if (!trimmed) {
    throw new PublicChatGuardError("agentId is required.", 400);
  }
  return trimmed;
}

export function assertPublicChatRateLimit(req: Request, sessionId: string): void {
  const ip = clientIpFromRequest(req);
  const perMinute = rateLimitPerMinute();

  const ipCheck = checkRateLimit(`chat:ip:${ip}`, perMinute, 60_000);
  if (!ipCheck.ok) {
    throw new PublicChatGuardError(
      "Too many requests. Please wait a moment and try again.",
      429,
      ipCheck.retryAfterSec
    );
  }

  const sessionCheck = checkRateLimit(
    `chat:session:${sessionId}`,
    Math.max(10, Math.floor(perMinute / 2)),
    60_000
  );
  if (!sessionCheck.ok) {
    throw new PublicChatGuardError(
      "Too many messages in a short time. Please slow down.",
      429,
      sessionCheck.retryAfterSec
    );
  }
}

/** Existing conversations require a valid visitor token. */
export function assertVisitorTokenForExistingChat(
  req: Request,
  sessionId: string,
  agentId: string,
  conversationExists: boolean
): void {
  if (!conversationExists) return;

  const token = visitorTokenFromRequest(req);
  if (!verifyVisitorSessionToken(token, sessionId, agentId)) {
    throw new PublicChatGuardError(
      "Invalid or missing visitor session token.",
      401
    );
  }
}

export function issueVisitorToken(sessionId: string, agentId: string): string {
  return mintVisitorSessionToken(sessionId, agentId);
}

export function guardResponseHeaders(
  res: Response,
  retryAfterSec?: number
): Response {
  if (retryAfterSec) {
    res.headers.set("Retry-After", String(retryAfterSec));
  }
  res.headers.set("Cache-Control", "no-store");
  return res;
}
