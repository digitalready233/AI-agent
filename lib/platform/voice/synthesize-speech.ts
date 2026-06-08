import OpenAI from "openai";

/** Synthesize speech that matches the displayed text exactly (ReadyBot replies are already short). */
export async function synthesizePlatformSpeech(
  text: string
): Promise<{ audioBase64: string; mimeType: string } | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const spoken = text.replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
  if (!apiKey || !spoken) return null;

  try {
    const client = new OpenAI({ apiKey });
    const response = await client.audio.speech.create({
      model: "tts-1",
      voice: "nova",
      input: spoken,
      response_format: "mp3",
    });
    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      audioBase64: buffer.toString("base64"),
      mimeType: "audio/mpeg",
    };
  } catch (err) {
    console.error("[platform-voice-tts] synthesis failed", err);
    return null;
  }
}
