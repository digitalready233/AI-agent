import type { CallOutcome } from "./types";

const RETRYABLE_OUTCOMES: CallOutcome[] = ["no_answer", "busy", "failed"];

export function isRetryableOutcome(outcome: CallOutcome | null | undefined): boolean {
  if (!outcome) return false;
  return RETRYABLE_OUTCOMES.includes(outcome);
}

export function computeNextAttemptAt(
  fromIso: string,
  retryDelayMinutes: number
): string {
  return new Date(
    new Date(fromIso).getTime() + retryDelayMinutes * 60 * 1000
  ).toISOString();
}

/** Map Twilio status + AMD to business call outcome. */
export function mapTwilioToCallOutcome(params: {
  callStatus: string;
  answeredBy?: string | null;
  durationSeconds?: number | null;
  handoffRequired?: boolean;
  bookingId?: string | null;
  leadCategory?: string | null;
  detectedIntent?: string | null;
}): CallOutcome {
  const amd = (params.answeredBy ?? "").toLowerCase();
  if (amd.includes("machine") || amd === "fax") return "voicemail";

  const st = params.callStatus.toLowerCase();
  if (st === "busy") return "busy";
  if (st === "no-answer" || st === "no_answer") return "no_answer";
  if (st === "failed" || st === "canceled") return "failed";

  if (params.handoffRequired || st === "transferred") return "human_transfer";
  if (params.bookingId) return "booked";

  const cat = (params.leadCategory ?? "").toLowerCase();
  const intent = (params.detectedIntent ?? "").toLowerCase();
  if (intent.includes("not_interested") || cat === "not_qualified") {
    return "not_interested";
  }
  if (
    cat === "hot" ||
    cat === "warm" ||
    cat === "qualified" ||
    intent.includes("qualified")
  ) {
    return "qualified";
  }

  if (st === "completed" || st === "in-progress" || st === "in_progress") {
    const dur = params.durationSeconds ?? 0;
    if (dur > 5) return "answered";
    return "no_answer";
  }

  return "failed";
}
