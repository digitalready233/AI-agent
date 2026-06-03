import { generateAgentReply } from "@/lib/agent/run-agent";
import { getFirstMessage } from "@/lib/greetings";
import { verifyTwilioSignature } from "@/lib/integrations/twilio-webhook";

const callSessions = new Map<string, { role: "user" | "assistant"; content: string }[]>();

/**
 * Twilio Voice webhook — returns TwiML.
 * Voice URL: https://YOUR-DOMAIN/api/twilio/voice
 *
 * **Production voice AI:** switch to [Twilio ConversationRelay](https://www.twilio.com/docs/voice/conversationrelay)
 * for low-latency streaming STT/LLM/TTS over a WebSocket from this app.
 */
export async function POST(req: Request) {
  const form = await req.formData();
  const params: Record<string, string> = {};
  form.forEach((value, key) => {
    if (typeof value === "string") params[key] = value;
  });

  if (!verifyTwilioSignature(req, params)) {
    return new Response("Forbidden", { status: 403 });
  }

  const callSid = params.CallSid ?? `call_${Date.now()}`;
  const speechResult = params.SpeechResult?.trim() || null;
  const sessionId = `voice_${callSid}`;
  let history = callSessions.get(sessionId) ?? [];

  if (history.length === 0) {
    history.push({
      role: "assistant",
      content: getFirstMessage("voice", "sales"),
    });
  }

  if (speechResult) {
    history.push({ role: "user", content: speechResult });
    let reply: string;
    try {
      reply = await generateAgentReply({
        messages: history,
        sessionId,
        channel: "voice",
        role: "unified",
      });
    } catch {
      reply =
        "I’m having trouble reaching our assistant right now. Please try again or contact the team by email.";
    }
    history.push({ role: "assistant", content: reply });
    callSessions.set(sessionId, history);

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" speechTimeout="auto" action="/api/twilio/voice" method="POST">
    <Say voice="Polly.Joanna">${escapeXml(reply)}</Say>
  </Gather>
</Response>`;
    return new Response(twiml, {
      headers: { "Content-Type": "text/xml" },
    });
  }

  const greeting = history[0]?.content ?? getFirstMessage("voice", "sales");
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" speechTimeout="auto" action="/api/twilio/voice" method="POST">
    <Say voice="Polly.Joanna">${escapeXml(greeting)}</Say>
  </Gather>
</Response>`;

  return new Response(twiml, {
    headers: { "Content-Type": "text/xml" },
  });
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .slice(0, 500);
}
