import OpenAI from "openai";
import { toFile } from "openai/uploads";

export type DemoTranscriptionResult = {
  transcript: string;
  confidence: number | null;
  language: string | null;
};

type SttBackend = {
  client: OpenAI;
  model: string;
};

function resolveSttBackend(): SttBackend {
  const groqKey = process.env.GROQ_API_KEY?.trim();
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  const preferGroq =
    process.env.AI_PROVIDER?.toLowerCase()?.trim() === "groq" ||
    (Boolean(groqKey) && !openaiKey);

  if (preferGroq && groqKey) {
    return {
      client: new OpenAI({
        apiKey: groqKey,
        baseURL: "https://api.groq.com/openai/v1",
      }),
      model: process.env.GROQ_WHISPER_MODEL?.trim() || "whisper-large-v3-turbo",
    };
  }
  if (openaiKey) {
    return {
      client: new OpenAI({ apiKey: openaiKey }),
      model: "whisper-1",
    };
  }
  if (groqKey) {
    return {
      client: new OpenAI({
        apiKey: groqKey,
        baseURL: "https://api.groq.com/openai/v1",
      }),
      model: process.env.GROQ_WHISPER_MODEL?.trim() || "whisper-large-v3-turbo",
    };
  }
  throw new Error(
    "Speech-to-text requires GROQ_API_KEY or OPENAI_API_KEY on the server."
  );
}

/** Server-side speech-to-text via Groq Whisper or OpenAI Whisper. */
export async function transcribeDemoAudio(params: {
  audioBuffer: Buffer;
  mimeType: string;
  filename?: string;
}): Promise<DemoTranscriptionResult> {
  if (params.audioBuffer.length < 512) {
    throw new Error("Recording too short. Hold the mic a little longer and try again.");
  }

  const { client, model } = resolveSttBackend();
  const ext = params.mimeType.includes("webm")
    ? "webm"
    : params.mimeType.includes("mp4") || params.mimeType.includes("m4a")
      ? "m4a"
      : params.mimeType.includes("wav")
        ? "wav"
        : "webm";

  const file = await toFile(params.audioBuffer, params.filename ?? `demo-audio.${ext}`, {
    type: params.mimeType || "audio/webm",
  });

  const response = await client.audio.transcriptions.create({
    file,
    model,
    language: "en",
    response_format: "verbose_json",
  });

  const verbose = response as {
    text?: string;
    language?: string;
    segments?: { avg_logprob?: number }[];
  };

  const transcript = (verbose.text ?? "").trim();
  if (!transcript) {
    throw new Error("No speech detected in the recording. Try speaking closer to the mic.");
  }

  let confidence: number | null = null;
  const segments = verbose.segments ?? [];
  if (segments.length > 0) {
    const logprobs = segments
      .map((s) => s.avg_logprob)
      .filter((n): n is number => typeof n === "number");
    if (logprobs.length > 0) {
      const avg = logprobs.reduce((a, b) => a + b, 0) / logprobs.length;
      confidence = Math.max(0, Math.min(1, Math.exp(avg)));
    }
  }

  return {
    transcript,
    confidence,
    language: verbose.language ?? null,
  };
}
