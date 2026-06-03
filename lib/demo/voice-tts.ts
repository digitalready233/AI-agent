import OpenAI from "openai";

/** Short spoken lines for demo voice mode — keeps responses brief per product rules. */
export function toDemoVoiceText(aiResponse: string, maxChars = 320): string {
  const trimmed = aiResponse.replace(/\s+/g, " ").trim();
  if (trimmed.length <= maxChars) return trimmed;
  const cut = trimmed.slice(0, maxChars);
  const lastStop = Math.max(cut.lastIndexOf("."), cut.lastIndexOf("?"));
  if (lastStop > 80) return cut.slice(0, lastStop + 1);
  return `${cut.trim()}…`;
}

export async function synthesizeDemoSpeech(
  text: string
): Promise<{ audioBase64: string; mimeType: string } | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey || !text.trim()) return null;

  try {
    const client = new OpenAI({ apiKey });
    const response = await client.audio.speech.create({
      model: "tts-1",
      voice: "nova",
      input: toDemoVoiceText(text),
      response_format: "mp3",
    });
    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      audioBase64: buffer.toString("base64"),
      mimeType: "audio/mpeg",
    };
  } catch (err) {
    console.error("[demo-voice-tts] synthesis failed", err);
    return null;
  }
}
