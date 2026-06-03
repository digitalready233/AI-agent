/** Classify LLM API failures for workflow + chat error messages. */

export type LlmErrorKind =
  | "quota"
  | "rate_limit"
  | "auth"
  | "model"
  | "network"
  | "unknown";

function errorText(err: unknown): string {
  if (err instanceof Error) {
    const parts = [err.message];
    const cause = (err as Error & { cause?: unknown }).cause;
    if (cause instanceof Error) parts.push(cause.message);
    return parts.join(" ");
  }
  return String(err);
}

function responseBody(err: unknown): string {
  const e = err as {
    responseBody?: string;
    data?: { error?: { code?: string; type?: string } };
    lastError?: { responseBody?: string; data?: { error?: { code?: string } } };
  };
  return (
    e.responseBody ??
    e.lastError?.responseBody ??
    JSON.stringify(e.data?.error ?? e.lastError?.data?.error ?? "")
  );
}

function statusCode(err: unknown): number | undefined {
  const e = err as { statusCode?: number; lastError?: { statusCode?: number } };
  return e.statusCode ?? e.lastError?.statusCode;
}

export function classifyLlmError(err: unknown): LlmErrorKind {
  const text = `${errorText(err)} ${responseBody(err)}`.toLowerCase();

  if (
    text.includes("insufficient_quota") ||
    text.includes("exceeded your current quota") ||
    text.includes("billing details")
  ) {
    return "quota";
  }

  if (
    text.includes("rate limit") ||
    text.includes("rate_limit") ||
    text.includes("too many requests")
  ) {
    return "rate_limit";
  }

  if (
    text.includes("invalid_api_key") ||
    text.includes("incorrect api key") ||
    text.includes("authentication") ||
    text.includes("unauthorized")
  ) {
    return "auth";
  }

  if (
    text.includes("model_not_found") ||
    text.includes("does not exist") ||
    text.includes("invalid model")
  ) {
    return "model";
  }

  const code = statusCode(err);
  if (code === 429) {
    return text.includes("quota") ? "quota" : "rate_limit";
  }
  if (code === 401 || code === 403) return "auth";

  if (
    text.includes("econnrefused") ||
    text.includes("fetch failed") ||
    text.includes("network")
  ) {
    return "network";
  }

  return "unknown";
}

/** Message for visitors (live chat, public embed). */
export function visitorLlmErrorMessage(kind: LlmErrorKind): string {
  switch (kind) {
    case "quota":
    case "rate_limit":
      return "Our assistant is temporarily unavailable. Please try again in a few minutes, or contact us directly and a team member will help you.";
    case "auth":
    case "model":
      return "Our assistant is being updated. Please try again shortly or reach out through our contact channels.";
    case "network":
      return "We could not reach the assistant service. Check your connection and try again.";
    default:
      return "Something went wrong while sending your message. Please try again.";
  }
}

/** Message for operators (dashboard, logs, API JSON). */
export function operatorLlmErrorMessage(kind: LlmErrorKind): string {
  switch (kind) {
    case "quota":
      return (
        "OpenAI quota exceeded. Add billing or credits at https://platform.openai.com/account/billing, " +
        "or set GROQ_API_KEY and AI_PROVIDER=groq in .env.local (then restart the dev server)."
      );
    case "rate_limit":
      return "LLM rate limit hit. Wait a moment or switch provider (AI_PROVIDER=groq) in .env.local.";
    case "auth":
      return "Invalid LLM API key. Check OPENAI_API_KEY or GROQ_API_KEY in .env.local.";
    case "model":
      return "LLM model not found. Check OPENAI_MODEL or GROQ_MODEL in .env.local.";
    case "network":
      return "Could not reach the LLM API. Check network, firewall, or OLLAMA_BASE_URL if using Ollama.";
    default:
      return "LLM request failed. See server logs for details.";
  }
}

/** Provider-level errors where trying another configured provider may help. */
export function isProviderFailoverError(err: unknown): boolean {
  const kind = classifyLlmError(err);
  return kind === "quota" || kind === "rate_limit" || kind === "auth" || kind === "model";
}
