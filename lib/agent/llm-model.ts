import type { LanguageModel } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { createOpenAI } from "@ai-sdk/openai";
import { createOllama } from "ollama-ai-provider";

export type LlmProviderId = "openai" | "groq" | "ollama";

/**
 * Pick provider: `AI_PROVIDER` wins; else first available key (OpenAI → Groq); else Ollama.
 */
export function getLlmProvider(): LlmProviderId {
  const explicit = process.env.AI_PROVIDER?.toLowerCase()?.trim();
  if (
    explicit === "openai" ||
    explicit === "groq" ||
    explicit === "ollama"
  ) {
    return explicit;
  }
  if (process.env.OPENAI_API_KEY?.trim()) return "openai";
  if (process.env.GROQ_API_KEY?.trim()) return "groq";
  return "ollama";
}

/** Providers to try in order (primary first, then configured fallbacks). */
export function getLlmProviderChain(): LlmProviderId[] {
  const primary = getLlmProvider();
  const chain: LlmProviderId[] = [primary];

  const add = (id: LlmProviderId) => {
    if (!chain.includes(id)) chain.push(id);
  };

  if (primary !== "openai" && process.env.OPENAI_API_KEY?.trim()) add("openai");
  if (primary !== "groq" && process.env.GROQ_API_KEY?.trim()) add("groq");
  if (
    primary === "ollama" ||
    (!process.env.OPENAI_API_KEY?.trim() && !process.env.GROQ_API_KEY?.trim())
  ) {
    add("ollama");
  }

  return chain;
}

export function getChatModelForProvider(provider: LlmProviderId): LanguageModel {
  switch (provider) {
    case "groq": {
      const key = process.env.GROQ_API_KEY?.trim();
      if (!key) {
        throw new Error("GROQ_API_KEY is required when using Groq (set AI_PROVIDER=groq or add the key).");
      }
      const groq = createGroq({ apiKey: key });
      const id = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
      return groq(id);
    }
    case "ollama": {
      const base =
        process.env.OLLAMA_BASE_URL?.trim() ??
        "http://127.0.0.1:11434/api";
      const ollama = createOllama({
        baseURL: base.replace(/\/$/, ""),
      });
      const id = process.env.OLLAMA_MODEL ?? "llama3.2";
      return ollama(id);
    }
    default: {
      const key = process.env.OPENAI_API_KEY?.trim();
      if (!key) {
        throw new Error("OPENAI_API_KEY is required when AI_PROVIDER is openai (or unset with OpenAI as default).");
      }
      const openai = createOpenAI({ apiKey: key });
      return openai(process.env.OPENAI_MODEL ?? "gpt-4o-mini");
    }
  }
}

export function getChatModel(): LanguageModel {
  return getChatModelForProvider(getLlmProvider());
}
