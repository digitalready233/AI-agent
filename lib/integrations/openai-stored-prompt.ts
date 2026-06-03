import OpenAI from "openai";
import {
  createDataStreamResponse,
  formatDataStreamPart,
  type DataStreamWriter,
} from "ai";
import type {
  EasyInputMessage,
  Response as OpenAIResponse,
  ResponseCreateParamsBase,
  ResponseCreateParamsNonStreaming,
  ResponseCreateParamsStreaming,
  ResponseStreamEvent,
} from "openai/resources/responses/responses";
import { openaiPrompt } from "../config";
import { logEvent } from "../analytics";
import type { Channel } from "../config";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export function useStoredOpenAIPrompt(): boolean {
  return Boolean(openaiPrompt.id?.trim());
}

function buildResponsesInput(
  messages: { role: string; content: string }[],
  extraContext?: string
): EasyInputMessage[] {
  const items: EasyInputMessage[] = [];

  if (extraContext?.trim()) {
    items.push({
      type: "message",
      role: "developer",
      content: `Supplementary context (use if not already in your prompt):\n${extraContext}`,
    });
  }

  for (const m of messages) {
    if (m.role === "system") continue;
    if (m.role === "user" || m.role === "assistant") {
      items.push({
        type: "message",
        role: m.role,
        content: m.content,
      });
    }
  }

  return items;
}

function buildBody(input: EasyInputMessage[]): ResponseCreateParamsBase {
  const inputPayload =
    input.length > 0
      ? input
      : ([
          { type: "message" as const, role: "user" as const, content: "Hello" },
        ] satisfies EasyInputMessage[]);

  const body: ResponseCreateParamsBase = {
    prompt: {
      id: openaiPrompt.id!,
      version: openaiPrompt.version,
    },
    input: inputPayload,
  };

  const responsesModel =
    process.env.OPENAI_RESPONSES_MODEL?.trim() ||
    (process.env.OPENAI_PROMPT_INCLUDE_MODEL === "true"
      ? process.env.OPENAI_MODEL?.trim()
      : undefined);
  if (responsesModel) {
    body.model = responsesModel;
  }

  return body;
}

type StreamWriteContext = {
  wroteAny: { value: boolean };
  /** Set when any output_text.delta was received (skip duplicate full text on .done). */
  gotOutputTextDelta: boolean;
};

function writeStreamEvent(
  dataStream: DataStreamWriter,
  event: ResponseStreamEvent,
  ctx: StreamWriteContext
) {
  switch (event.type) {
    case "response.output_text.delta": {
      const delta =
        "delta" in event && typeof (event as { delta?: unknown }).delta === "string"
          ? (event as { delta: string }).delta
          : "";
      if (delta) {
        ctx.gotOutputTextDelta = true;
        dataStream.write(formatDataStreamPart("text", delta));
        ctx.wroteAny.value = true;
      }
      break;
    }
    case "response.output_text.done": {
      const text =
        "text" in event && typeof (event as { text?: unknown }).text === "string"
          ? (event as { text: string }).text
          : "";
      if (text.trim() && !ctx.gotOutputTextDelta) {
        dataStream.write(formatDataStreamPart("text", text));
        ctx.wroteAny.value = true;
      }
      break;
    }
    case "response.reasoning_text.delta":
    case "response.reasoning_summary_text.delta": {
      const delta =
        "delta" in event && typeof (event as { delta?: unknown }).delta === "string"
          ? (event as { delta: string }).delta
          : "";
      if (delta) {
        dataStream.write(formatDataStreamPart("reasoning", delta));
        ctx.wroteAny.value = true;
      }
      break;
    }
    case "response.refusal.delta": {
      const delta =
        "delta" in event && typeof (event as { delta?: unknown }).delta === "string"
          ? (event as { delta: string }).delta
          : "";
      if (delta) {
        dataStream.write(formatDataStreamPart("text", delta));
        ctx.wroteAny.value = true;
      }
      break;
    }
    case "error": {
      const msg =
        "message" in event && typeof (event as { message?: unknown }).message === "string"
          ? (event as { message: string }).message
          : "OpenAI returned an error in the stream.";
      // Use `text`, not `error` stream parts: @ai-sdk/ui `onErrorPart` throws and the assistant bubble stays empty.
      dataStream.write(
        formatDataStreamPart(
          "text",
          `Sorry — I could not complete that request. (${msg})`
        )
      );
      ctx.wroteAny.value = true;
      break;
    }
    default:
      break;
  }
}

/** Stream chat using your OpenAI Dashboard Prompt (pmpt_...). */
export function streamStoredPromptResponse(options: {
  messages: { role: string; content: string }[];
  sessionId: string;
  channel?: Channel;
  extraContext?: string;
}): Response {
  const channel = options.channel ?? "website";
  logEvent("conversation_started", options.sessionId, channel);

  return createDataStreamResponse({
    execute: async (dataStream) => {
      const input = buildResponsesInput(options.messages, options.extraContext);
      const ctx: StreamWriteContext = {
        wroteAny: { value: false },
        gotOutputTextDelta: false,
      };

      try {
        const streamParams: ResponseCreateParamsStreaming = {
          ...buildBody(input),
          stream: true,
        };
        const stream = await client.responses.create(streamParams);

        for await (const event of stream) {
          writeStreamEvent(dataStream, event, ctx);
        }

        if (!ctx.wroteAny.value) {
          const nonStreamParams: ResponseCreateParamsNonStreaming = {
            ...buildBody(input),
            stream: false,
          };
          const fallback = (await client.responses.create(
            nonStreamParams
          )) as OpenAIResponse;
          const text = fallback.output_text?.trim();
          if (text) {
            dataStream.write(formatDataStreamPart("text", text));
            ctx.wroteAny.value = true;
          } else {
            dataStream.write(
              formatDataStreamPart(
                "text",
                "Sorry — no reply was returned. Check OPENAI_PROMPT_ID / version, billing, and that your hosted prompt is published."
              )
            );
          }
        }
      } catch (e) {
        const message =
          e instanceof Error
            ? e.message
            : "OpenAI request failed. Check OPENAI_API_KEY, prompt id, and network.";
        dataStream.write(
          formatDataStreamPart(
            "text",
            `Sorry — something went wrong. ${message}`
          )
        );
      } finally {
        dataStream.write(
          formatDataStreamPart("finish_message", { finishReason: "stop" })
        );
      }
    },
    onError: (error) =>
      error instanceof Error ? error.message : "OpenAI prompt request failed",
  });
}

/** Non-streaming (WhatsApp / voice). */
export async function generateStoredPromptReply(options: {
  messages: { role: string; content: string }[];
  extraContext?: string;
}): Promise<string> {
  const input = buildResponsesInput(options.messages, options.extraContext);
  try {
    const params: ResponseCreateParamsNonStreaming = {
      ...buildBody(input),
      stream: false,
    };
    const response = (await client.responses.create(params)) as OpenAIResponse;
    return response.output_text?.trim() || "How can I help you today?";
  } catch (e) {
    return e instanceof Error ? e.message : "Sorry, something went wrong. Please try again.";
  }
}
