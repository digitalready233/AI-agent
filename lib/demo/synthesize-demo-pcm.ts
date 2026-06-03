import OpenAI from "openai";
import { toDemoVoiceText } from "./voice-tts";

/** OpenAI TTS PCM: 24 kHz, 16-bit mono little-endian */
export const DEMO_TTS_PCM_SAMPLE_RATE = 24_000;
export const DEMO_TTS_PCM_CHANNELS = 1;

export async function synthesizeDemoSpeechPcm(
  text: string
): Promise<{ pcm: Buffer; sampleRate: number; channels: number } | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey || !text.trim()) return null;

  try {
    const client = new OpenAI({ apiKey });
    const response = await client.audio.speech.create({
      model: "tts-1",
      voice: "nova",
      input: toDemoVoiceText(text),
      response_format: "pcm",
    });
    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      pcm: buffer,
      sampleRate: DEMO_TTS_PCM_SAMPLE_RATE,
      channels: DEMO_TTS_PCM_CHANNELS,
    };
  } catch (err) {
    console.error("[synthesizeDemoSpeechPcm] failed", err);
    return null;
  }
}
