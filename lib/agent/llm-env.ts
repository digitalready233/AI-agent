import { getLlmProvider } from "./llm-model";

/**
 * True when the active provider has the credentials it needs for chat/voice replies
 * (stored OpenAI prompt path still requires OPENAI separately).
 */
export function isLlmConfigured(): boolean {
  const provider = getLlmProvider();
  if (provider === "openai") return !!process.env.OPENAI_API_KEY?.trim();
  if (provider === "groq") return !!process.env.GROQ_API_KEY?.trim();
  return true;
}

export function llmConfigErrorMessage(): string {
  const explicit = process.env.AI_PROVIDER?.toLowerCase()?.trim();
  if (explicit === "groq") {
    return "LLM not configured. Set GROQ_API_KEY on the server and restart PM2 (AI_PROVIDER=groq).";
  }
  if (explicit === "openai") {
    return "LLM not configured. Set OPENAI_API_KEY on the server and restart PM2 (AI_PROVIDER=openai).";
  }
  return "LLM not configured. Set GROQ_API_KEY or OPENAI_API_KEY on the server and restart PM2.";
}

export function isTranscriptionConfigured(): boolean {
  return Boolean(
    process.env.GROQ_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim()
  );
}

export function transcriptionConfigErrorMessage(): string {
  return "Speech-to-text is not configured. Set GROQ_API_KEY (Groq Whisper) or OPENAI_API_KEY on the server and restart PM2.";
}
