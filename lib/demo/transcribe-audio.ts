import OpenAI from "openai";
import { toFile } from "openai/uploads";

export type DemoTranscriptionResult = {
  transcript: string;
  confidence: number | null;
  language: string | null;
};

/** Server-side speech-to-text via OpenAI (never expose API key to the browser). */
export async function transcribeDemoAudio(params: {
  audioBuffer: Buffer;
  mimeType: string;
  filename?: string;
}): Promise<DemoTranscriptionResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured for transcription.");
  }

  const client = new OpenAI({ apiKey });
  const ext =
    params.mimeType.includes("webm")
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
    model: "whisper-1",
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
    throw new Error("No speech detected in the recording.");
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
