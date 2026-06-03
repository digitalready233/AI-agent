import type { LanguageModel } from "ai";
import { generateObject, generateText, NoObjectGeneratedError } from "ai";
import type { z } from "zod";
import {
  classifyLlmError,
  isProviderFailoverError,
  operatorLlmErrorMessage,
} from "@/lib/agent/llm-errors";
import { getChatModelForProvider, getLlmProviderChain } from "@/lib/agent/llm-model";
import { tryParseAnalysisFromError } from "./normalize-analysis";
import { WorkflowError } from "./types";

async function withProviderFailover<T>(
  label: string,
  run: (model: LanguageModel, provider: string) => Promise<T>
): Promise<T> {
  const chain = getLlmProviderChain();
  let lastError: unknown;

  for (let i = 0; i < chain.length; i++) {
    const provider = chain[i]!;
    try {
      const model = getChatModelForProvider(provider);
      if (i > 0) {
        console.warn(`[runAgentWorkflow] ${label}: retrying with provider ${provider}`);
      }
      return await run(model, provider);
    } catch (err) {
      lastError = err;
      const canFailover = isProviderFailoverError(err) && i < chain.length - 1;
      console.error(`[runAgentWorkflow] ${label} failed (${provider})`, err);
      if (!canFailover) break;
    }
  }

  if (NoObjectGeneratedError.isInstance(lastError)) {
    throw lastError;
  }

  const kind = classifyLlmError(lastError);
  throw new WorkflowError(
    operatorLlmErrorMessage(kind),
    kind === "quota" ? "LLM_QUOTA_EXCEEDED" : "LLM_REQUEST_FAILED",
    kind === "quota" || kind === "rate_limit" ? 503 : 502
  );
}

export async function workflowGenerateObject<T extends z.ZodType>(params: {
  label: string;
  schema: T;
  system: string;
  prompt: string;
  temperature?: number;
  /** When structured output fails validation, try to repair JSON from the raw response. */
  repairOnSchemaError?: boolean;
}): Promise<z.infer<T>> {
  try {
    const { object } = await withProviderFailover(params.label, (model) =>
      generateObject({
        model,
        schema: params.schema,
        system: params.system,
        prompt: params.prompt,
        temperature: params.temperature ?? 0.2,
        maxRetries: 0,
      })
    );
    return object;
  } catch (err) {
    if (params.repairOnSchemaError) {
      const repaired = tryParseAnalysisFromError(err);
      if (repaired) {
        console.warn(
          `[runAgentWorkflow] ${params.label}: repaired schema mismatch from model output`
        );
        return repaired as z.infer<T>;
      }
    }
    throw err;
  }
}

export async function workflowGenerateText(params: {
  label: string;
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  maxTokens?: number;
  temperature?: number;
}): Promise<string> {
  const { text } = await withProviderFailover(params.label, (model) =>
    generateText({
      model,
      system: params.system,
      messages: params.messages,
      maxTokens: params.maxTokens ?? 900,
      temperature: params.temperature ?? 0.6,
      maxRetries: 0,
    })
  );
  return text;
}
