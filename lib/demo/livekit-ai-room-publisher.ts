/**
 * Server-only: publishes AI speech into a LiveKit room as a real audio track.
 * Run via scripts/demo-livekit-ai-bridge.ts — do not import from Next.js route handlers
 * (native @livekit/rtc-node bindings).
 */
import {
  AudioFrame,
  AudioSource,
  LocalAudioTrack,
  Room,
  TrackPublishOptions,
  TrackSource,
  dispose,
} from "@livekit/rtc-node";
import { createDemoLiveKitToken, demoLiveKitRoomName } from "./livekit-token";
import { demoAiParticipantDisplayName, demoAiParticipantIdentity } from "./demo-livekit-ai-prompt";
import { getAgent } from "@/lib/platform/data";
import { DEMO_TTS_PCM_CHANNELS, DEMO_TTS_PCM_SAMPLE_RATE } from "./synthesize-demo-pcm";
import type { DemoAiRoomSyncPayload } from "./demo-livekit-ai-audio";

type SessionPublisher = {
  sessionId: string;
  room: Room;
  source: AudioSource;
  track: LocalAudioTrack;
  identity: string;
  muted: boolean;
};

const publishers = new Map<string, SessionPublisher>();

function pcmToInt16(pcm: Buffer): Int16Array {
  const aligned = pcm.byteOffset % 2 === 0 ? pcm : Buffer.from(pcm);
  return new Int16Array(
    aligned.buffer,
    aligned.byteOffset,
    Math.floor(aligned.byteLength / 2)
  );
}

async function streamPcmToSource(
  source: AudioSource,
  pcm: Buffer,
  sampleRate: number,
  channels: number
) {
  const samples = pcmToInt16(pcm);
  const samplesPerChannelTotal = Math.floor(samples.length / channels);
  const frameSamples = Math.floor(sampleRate / 50);
  let offset = 0;

  while (offset < samplesPerChannelTotal) {
    const count = Math.min(frameSamples, samplesPerChannelTotal - offset);
    const slice = samples.subarray(offset * channels, (offset + count) * channels);
    const frame = new AudioFrame(slice, sampleRate, channels, count);
    await source.captureFrame(frame);
    offset += count;
  }
  await source.waitForPlayout();
}

export async function connectDemoAiLiveKitPublisher(params: {
  demoSessionId: string;
  agentId: string;
}): Promise<{ ok: boolean; identity?: string; error?: string; audio_track_published?: boolean }> {
  const existing = publishers.get(params.demoSessionId);
  if (existing) {
    return { ok: true, identity: existing.identity };
  }

  const url = process.env.LIVEKIT_URL?.trim();
  if (!url) return { ok: false, error: "LIVEKIT_URL not set" };

  const agent = await getAgent(params.agentId);
  if (!agent) return { ok: false, error: "Agent not found" };

  const identity = demoAiParticipantIdentity(params.agentId, params.demoSessionId);
  const displayName = demoAiParticipantDisplayName(agent.name);

  const tokenBundle = await createDemoLiveKitToken({
    sessionId: params.demoSessionId,
    identity,
    name: displayName,
    role: "ai_agent",
  });
  if (!tokenBundle?.token) {
    return { ok: false, error: "Could not create LiveKit token" };
  }

  const room = new Room();
  try {
    await room.connect(url, tokenBundle.token, {
      autoSubscribe: true,
      dynacast: true,
    });

    const sampleRate = DEMO_TTS_PCM_SAMPLE_RATE;
    const channels = DEMO_TTS_PCM_CHANNELS;
    const source = new AudioSource(sampleRate, channels);
    const track = LocalAudioTrack.createAudioTrack("ai-voice", source);
    const options = new TrackPublishOptions();
    options.source = TrackSource.SOURCE_MICROPHONE;
    await room.localParticipant?.publishTrack(track, options);

    publishers.set(params.demoSessionId, {
      sessionId: params.demoSessionId,
      room,
      source,
      track,
      identity,
      muted: false,
    });

    return { ok: true, identity, audio_track_published: true };
  } catch (e) {
    try {
      await room.disconnect();
    } catch {
      /* ignore */
    }
    return { ok: false, error: e instanceof Error ? e.message : "Connect failed" };
  }
}

export async function publishDemoAiPcmToLiveKit(params: {
  demoSessionId: string;
  pcm: Buffer;
  sampleRate?: number;
  channels?: number;
}): Promise<{ ok: boolean; error?: string }> {
  const pub = publishers.get(params.demoSessionId);
  if (!pub) {
    return { ok: false, error: "AI publisher not connected to room" };
  }
  if (pub.muted) {
    return { ok: false, error: "AI audio paused (human takeover)" };
  }

  try {
    await streamPcmToSource(
      pub.source,
      params.pcm,
      params.sampleRate ?? DEMO_TTS_PCM_SAMPLE_RATE,
      params.channels ?? DEMO_TTS_PCM_CHANNELS
    );
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Publish failed" };
  }
}

export async function muteDemoAiLiveKitPublisher(
  demoSessionId: string,
  muted: boolean
): Promise<{ ok: boolean; error?: string }> {
  const pub = publishers.get(demoSessionId);
  if (!pub) {
    return { ok: false, error: "AI publisher not connected" };
  }
  pub.muted = muted;
  return { ok: true };
}

export async function publishDemoAiRoomSync(
  demoSessionId: string,
  payload: DemoAiRoomSyncPayload
): Promise<{ ok: boolean; error?: string }> {
  const pub = publishers.get(demoSessionId);
  if (!pub?.room.localParticipant) {
    return { ok: false, error: "AI publisher not connected" };
  }
  try {
    const data = new TextEncoder().encode(JSON.stringify(payload));
    await pub.room.localParticipant.publishData(data, { reliable: true });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Data publish failed" };
  }
}

export async function disconnectDemoAiLiveKitPublisher(
  demoSessionId: string
): Promise<void> {
  const pub = publishers.get(demoSessionId);
  if (!pub) return;

  publishers.delete(demoSessionId);
  try {
    await pub.track.close();
    await pub.source.close();
    await pub.room.disconnect();
  } catch (e) {
    console.warn("[livekit-ai-room-publisher] disconnect", e);
  }
}

export async function shutdownAllDemoAiPublishers(): Promise<void> {
  const ids = [...publishers.keys()];
  for (const id of ids) {
    await disconnectDemoAiLiveKitPublisher(id);
  }
  await dispose();
}

export function demoAiPublisherConnected(demoSessionId: string): boolean {
  return publishers.has(demoSessionId);
}

export function liveKitRoomNameForSession(demoSessionId: string): string {
  return demoLiveKitRoomName(demoSessionId);
}
