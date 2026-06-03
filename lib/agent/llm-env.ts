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
