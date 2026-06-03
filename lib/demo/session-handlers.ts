import { z } from "zod";
import {
  findOrCreateConversationBySession,
  getAgent,
  getLead,
  saveConversation,
  saveLead,
} from "@/lib/platform/data";
import {
  getDemoSession,
  listDemoMessages,
  listDemoParticipants,
  saveDemoMessage,
  saveDemoParticipant,
  saveDemoSession,
} from "./demo-data";
import { endDemoSession } from "./end-demo-session";
import {
  getDemoProviderSettings,
  isDemoSessionExpired,
  effectiveDemoProvider,
} from "./demo-provider";
import {
  issueLiveKitParticipantToken,
  shouldUseLiveKitVideo,
} from "./livekit-service";
import { orgLiveKitVideoEnabled } from "./demo-provider";
import { isDemoRoomAiEnabled } from "./config";
import { runDemoWorkflow } from "./run-demo-workflow";
import { requestDemoHumanHandoff } from "./request-handoff";
import { saveDemoTranscriptSegment, mapSenderToSpeakerType } from "./transcript-segment";
import { synthesizeDemoSpeech, toDemoVoiceText } from "./voice-tts";
import { transcribeDemoAudio } from "./transcribe-audio";
import { applyDemoVoicePhrases } from "./voice-phrases";
import { formatDemoSummaryText, generateDemoSummaryFromTranscript } from "./demo-summary";
import { rebuildSessionTranscript } from "./demo-data";
import { processDemoLiveKitAiMessage } from "./demo-livekit-ai-worker";

const joinBodySchema = z.object({
  display_name: z.string().max(120).optional(),
  name: z.string().max(120).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(40).optional(),
  role: z.enum(["prospect", "staff"]).default("prospect"),
});

export async function handleDemoSessionJoin(
  sessionId: string,
  body: unknown
) {
  const parsed = joinBodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    return { status: 400 as const, body: { error: parsed.error.flatten() } };
  }

  const session = await getDemoSession(sessionId);
  if (!session) return { status: 404 as const, body: { error: "Demo not found" } };

  const providerSettings = await getDemoProviderSettings(session.organization_id);
  if (
    isDemoSessionExpired({
      startedAt: session.started_at,
      createdAt: session.created_at,
      timeoutMinutes: providerSettings.demo_session_timeout_minutes,
    }) &&
    session.status !== "completed"
  ) {
    return { status: 410 as const, body: { error: "This demo session has expired." } };
  }

  if (session.status === "completed" || session.status === "cancelled") {
    return { status: 400 as const, body: { error: "This demo has already ended." } };
  }

  const agent = session.agent_id ? await getAgent(session.agent_id) : null;
  if (!agent?.enabled) {
    return { status: 404 as const, body: { error: "Demo not available" } };
  }

  const now = new Date().toISOString();
  const guestName =
    parsed.data.name?.trim() ||
    parsed.data.display_name?.trim() ||
    (parsed.data.role === "staff" ? "Team member" : "Guest");

  await saveDemoParticipant({
    id: crypto.randomUUID(),
    organization_id: session.organization_id,
    demo_session_id: sessionId,
    role: parsed.data.role,
    lead_id: session.lead_id,
    name: guestName,
    display_name: guestName,
    email: parsed.data.email ?? null,
    phone: parsed.data.phone ?? null,
    joined_at: now,
    left_at: null,
    created_at: now,
  });

  let conversationId = session.conversation_id;
  if (session.agent_id) {
    let conv = await findOrCreateConversationBySession({
      organizationId: session.organization_id,
      agentId: session.agent_id,
      sessionId,
      channel: "demo_call",
    });
    conversationId = conv.id;

    if (session.lead_id) {
      const lead = await getLead(session.lead_id);
      if (lead) {
        const updated = {
          ...lead,
          ...(parsed.data.display_name?.trim() && {
            full_name: parsed.data.display_name.trim(),
          }),
          ...(parsed.data.email && { email: parsed.data.email }),
          updated_at: now,
        };
        await saveLead(updated);
        conv = await saveConversation({
          ...conv,
          lead_id: updated.id,
          customer_name: updated.full_name,
          customer_email: updated.email,
          customer_phone: updated.phone,
          updated_at: now,
        });
      }
    }
  }

  const welcome =
    agent.welcome_message ??
    `Welcome! I'm ${agent.name}. What would you like to explore in today's demo?`;

  const priorMessages = await listDemoMessages(sessionId);
  const hasAgentMessage = priorMessages.some((m) => m.sender_type === "agent");

  await saveDemoSession({
    ...session,
    conversation_id: conversationId ?? session.conversation_id,
    status:
      session.status === "scheduled" || session.status === "waiting"
        ? "in_progress"
        : session.status,
    started_at: session.started_at ?? now,
    metadata: {
      ...(session.metadata ?? {}),
      stage: "realtime_v1",
      provider: effectiveDemoProvider(providerSettings),
    },
  });

  if (!hasAgentMessage && parsed.data.role === "prospect") {
    await saveDemoMessage({
      id: crypto.randomUUID(),
      organization_id: session.organization_id,
      demo_session_id: sessionId,
      sender_type: "agent",
      sender_name: agent.name,
      content: welcome,
      created_at: now,
    });
    if (providerSettings.enable_transcript) {
      await saveDemoTranscriptSegment({
        organizationId: session.organization_id,
        demoSessionId: sessionId,
        speaker: agent.name,
        speakerType: "agent",
        content: welcome,
        inputType: "text",
      });
    }
  }

  const messages = await listDemoMessages(sessionId);
  const participants = await listDemoParticipants(sessionId);

  return {
    status: 200 as const,
    body: {
      joined: true,
      welcome_message: hasAgentMessage ? null : welcome,
      conversation_id: conversationId ?? null,
      agent: {
        id: agent.id,
        name: agent.name,
        company_product_name: agent.company_product_name,
      },
      session: await getDemoSession(sessionId),
      messages,
      participants,
      provider: effectiveDemoProvider(providerSettings),
      provider_settings: {
        enable_voice_demo: providerSettings.enable_voice_demo,
        enable_human_takeover: providerSettings.enable_human_takeover,
        enable_transcript: providerSettings.enable_transcript,
        connection_status: providerSettings.connection_status,
        branding: providerSettings.demo_room_branding,
      },
    },
  };
}

export async function handleDemoSessionToken(
  sessionId: string,
  body: { identity?: string; name?: string; role?: "prospect" | "staff" }
) {
  const session = await getDemoSession(sessionId);
  if (!session) return { status: 404 as const, body: { error: "Demo not found" } };

  const providerSettings = await getDemoProviderSettings(session.organization_id);
  const identity = body.identity?.trim() || `guest-${sessionId.slice(0, 8)}`;
  const name = body.name?.trim() || "Guest";
  const role = body.role ?? "prospect";

  const useLiveKit =
    shouldUseLiveKitVideo(session) || orgLiveKitVideoEnabled(providerSettings);

  let livekitPayload: {
    url: string;
    room_name: string;
    token: string;
    identity: string;
    role: string;
  } | null = null;

  if (useLiveKit) {
    try {
      const issued = await issueLiveKitParticipantToken({
        sessionId,
        identity,
        name,
        role,
        ensureRoom: true,
      });
      livekitPayload = {
        url: issued.url,
        room_name: issued.roomName,
        token: issued.token,
        identity: issued.identity,
        role: issued.role,
      };
    } catch {
      livekitPayload = null;
    }
  }

  return {
    status: 200 as const,
    body: {
      provider: effectiveDemoProvider(providerSettings),
      video_provider: livekitPayload ? "livekit" : "internal",
      livekit: livekitPayload,
      internal_mode: !livekitPayload,
    },
  };
}

export async function handleDemoSessionStart(sessionId: string) {
  const session = await getDemoSession(sessionId);
  if (!session) return { status: 404 as const, body: { error: "Demo not found" } };

  const agent = session.agent_id ? await getAgent(session.agent_id) : null;
  if (!agent?.enabled) {
    return { status: 404 as const, body: { error: "Demo not available" } };
  }

  const now = new Date().toISOString();
  const welcome =
    agent.welcome_message ??
    `Welcome! I'm ${agent.name}. What would you like to explore in today's demo?`;

  const priorMessages = await listDemoMessages(sessionId);
  if (!priorMessages.some((m) => m.sender_type === "agent")) {
    await saveDemoMessage({
      id: crypto.randomUUID(),
      organization_id: session.organization_id,
      demo_session_id: sessionId,
      sender_type: "agent",
      sender_name: agent.name,
      content: welcome,
      created_at: now,
    });
  }

  await saveDemoSession({
    ...session,
    status: "in_progress",
    started_at: session.started_at ?? now,
    current_demo_stage: session.current_demo_stage || "welcome",
  });

  return {
    status: 200 as const,
    body: {
      started: true,
      welcome_message: welcome,
      session: await getDemoSession(sessionId),
    },
  };
}

export async function handleDemoSessionEnd(sessionId: string) {
  const result = await endDemoSession({ demoSessionId: sessionId });
  const session = await getDemoSession(sessionId);
  return {
    status: 200 as const,
    body: { summary: result.summary, session },
  };
}

export async function handleDemoHumanTakeover(
  sessionId: string,
  opts: { requestedBy: "prospect" | "staff"; staffUserId?: string; notes?: string }
) {
  const session = await getDemoSession(sessionId);
  if (!session) return { status: 404 as const, body: { error: "Demo not found" } };

  const providerSettings = await getDemoProviderSettings(session.organization_id);
  if (!providerSettings.enable_human_takeover) {
    return { status: 403 as const, body: { error: "Human takeover is disabled for demos." } };
  }

  if (opts.requestedBy === "prospect") {
    await requestDemoHumanHandoff({
      demoSessionId: sessionId,
      requestedBy: "prospect",
      notes: opts.notes,
      reason: "human_requested",
    });
    const updated = await getDemoSession(sessionId);
    return {
      status: 200 as const,
      body: {
        handoff_required: true,
        status: updated?.status,
        handoff_status: updated?.handoff_status,
        session: updated,
      },
    };
  }

  await requestDemoHumanHandoff({
    demoSessionId: sessionId,
    requestedBy: "staff",
    notes: opts.notes,
  });

  return {
    status: 200 as const,
    body: {
      handoff_required: true,
      session: await getDemoSession(sessionId),
    },
  };
}

const voiceBodySchema = z.object({
  transcript: z.string().min(1).max(8000).optional(),
  display_name: z.string().max(120).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(40).optional(),
  current_demo_asset_id: z.string().uuid().optional(),
  /** Set when prospect segment was already saved by /transcribe */
  prospect_transcript_saved: z.boolean().optional(),
});

export async function handleDemoVoiceTurn(sessionId: string, body: unknown) {
  const parsed = voiceBodySchema.safeParse(body);
  if (!parsed.success) {
    return { status: 400 as const, body: { error: parsed.error.flatten() } };
  }
  if (!parsed.data.transcript?.trim()) {
    return { status: 400 as const, body: { error: "transcript is required for voice turns" } };
  }

  const session = await getDemoSession(sessionId);
  if (!session) return { status: 404 as const, body: { error: "Demo not found" } };
  if (session.status === "completed" || session.status === "cancelled") {
    return { status: 400 as const, body: { error: "Demo has ended" } };
  }

  const agent = session.agent_id ? await getAgent(session.agent_id) : null;
  if (!agent?.enabled) {
    return { status: 404 as const, body: { error: "Demo not available" } };
  }

  const providerSettings = await getDemoProviderSettings(session.organization_id);
  if (!providerSettings.enable_voice_demo) {
    return { status: 403 as const, body: { error: "Voice demo is disabled." } };
  }

  if (!isDemoRoomAiEnabled()) {
    return { status: 503 as const, body: { error: "AI demo workflow is not enabled." } };
  }

  const customerMessage = parsed.data.transcript.trim();

  if (
    providerSettings.enable_transcript &&
    !parsed.data.prospect_transcript_saved
  ) {
    await saveDemoTranscriptSegment({
      organizationId: session.organization_id,
      demoSessionId: sessionId,
      speaker: parsed.data.display_name?.trim() || "Prospect",
      speakerType: "prospect",
      content: customerMessage,
      inputType: "voice",
    });
  }

  const useLiveKitAi =
    session.ai_joined === true &&
    (session.ai_status === "active" || session.ai_status === "starting");

  let result;
  let audio_base64: string | null = null;
  let audio_mime_type: string | null = null;
  let use_browser_tts = true;

  if (useLiveKitAi) {
    const aiTurn = await processDemoLiveKitAiMessage({
      demoSessionId: sessionId,
      message: customerMessage,
      transcriptSegment: customerMessage,
      inputType: "voice",
      currentDemoAssetId:
        parsed.data.current_demo_asset_id ?? session.current_demo_asset_id,
      customerMetadata: {
        name: parsed.data.display_name,
        email: parsed.data.email,
        phone: parsed.data.phone,
      },
    });
    if (!aiTurn.ok && aiTurn.ai_response) {
      return {
        status: 200 as const,
        body: {
          reply: aiTurn.ai_response,
          ai_voice_text: aiTurn.ai_voice_text ?? aiTurn.ai_response,
          audio_base64: aiTurn.audio_base64 ?? null,
          audio_mime_type: aiTurn.audio_mime_type ?? null,
          use_browser_tts: aiTurn.use_browser_tts ?? true,
          ai_paused: aiTurn.phase === "paused",
        },
      };
    }
    audio_base64 = aiTurn.audio_base64 ?? null;
    audio_mime_type = aiTurn.audio_mime_type ?? null;
    use_browser_tts = aiTurn.use_browser_tts ?? true;
    result = {
      aiResponse: aiTurn.ai_response ?? "",
      aiVoiceText: aiTurn.ai_voice_text,
      currentDemoStage: aiTurn.demo_stage ?? session.current_demo_stage,
      leadScore: aiTurn.lead_score ?? session.lead_score ?? 0,
      leadCategory: aiTurn.lead_category ?? session.lead_category,
      bookingRecommended: aiTurn.booking_recommended ?? session.booking_recommended,
      handoffRequired: aiTurn.handoff_required ?? session.handoff_required,
      recommendedNextAction:
        aiTurn.recommended_next_action ?? session.recommended_next_action,
      nextDemoAsset: aiTurn.next_asset
        ? {
            id: aiTurn.next_asset.id,
            title: aiTurn.next_asset.title,
            content: aiTurn.next_asset.content,
            asset_type: aiTurn.next_asset.asset_type,
          }
        : null,
      messageId: aiTurn.message_id ?? "",
      structured: aiTurn.structured,
      qualificationProgress:
        (aiTurn.qualification_progress as typeof session.qualification_progress) ??
        session.qualification_progress,
      objections: aiTurn.objections ?? session.objections ?? [],
      selectedDemoPathId: aiTurn.selected_demo_path_id ?? session.demo_path_id,
      selectedDemoPathTitle: aiTurn.selected_demo_path_title ?? null,
      demoStage: aiTurn.demo_stage ?? session.current_demo_stage,
      aiPaused: aiTurn.phase === "paused",
    };
  } else {
    result = await runDemoWorkflow({
      organizationId: session.organization_id,
      demoSessionId: sessionId,
      agentId: agent.id,
      leadId: session.lead_id,
      customerMessage,
      inputType: "voice",
      participantRole: "prospect",
      transcriptSegment: customerMessage,
      currentDemoStep: session.current_demo_stage,
      currentDemoAssetId:
        parsed.data.current_demo_asset_id ??
        (typeof session.metadata?.last_asset_id === "string"
          ? session.metadata.last_asset_id
          : null),
      channel: "demo_call",
      customerMetadata: {
        name: parsed.data.display_name,
        email: parsed.data.email,
        phone: parsed.data.phone,
      },
    });
  }

  const spokenText = applyDemoVoicePhrases({
    text: result.aiVoiceText ?? toDemoVoiceText(result.aiResponse),
    handoffRequired: result.handoffRequired,
    bookingRecommended: result.bookingRecommended,
  });

  if (providerSettings.enable_transcript && result.aiResponse) {
    await saveDemoTranscriptSegment({
      organizationId: session.organization_id,
      demoSessionId: sessionId,
      speaker: agent.name,
      speakerType: "agent",
      content: spokenText,
      inputType: "voice",
      metadata: { message_id: result.messageId },
    });
  }

  return {
    status: 200 as const,
    body: {
      reply: result.aiResponse,
      ai_voice_text: spokenText,
      audio_base64,
      audio_mime_type,
      use_browser_tts,
      current_demo_stage: result.currentDemoStage,
      lead_score: result.leadScore,
      lead_category: result.leadCategory,
      booking_recommended: result.bookingRecommended,
      handoff_required: result.handoffRequired,
      recommended_next_action: result.recommendedNextAction,
      next_asset: result.nextDemoAsset
        ? {
            id: result.nextDemoAsset.id,
            title: result.nextDemoAsset.title,
            content: result.nextDemoAsset.content,
            asset_type: result.nextDemoAsset.asset_type,
          }
        : null,
      ai_paused: result.aiPaused ?? false,
      structured: result.structured,
      qualification_progress: result.qualificationProgress,
      objections: result.objections,
      selected_demo_path_id: result.selectedDemoPathId,
      selected_demo_path_title: result.selectedDemoPathTitle,
      demo_stage: result.demoStage,
    },
  };
}

const speakBodySchema = z.object({
  text: z.string().min(1).max(4000),
});

export async function handleDemoSpeak(sessionId: string, body: unknown) {
  const parsed = speakBodySchema.safeParse(body);
  if (!parsed.success) {
    return { status: 400 as const, body: { error: parsed.error.flatten() } };
  }

  const session = await getDemoSession(sessionId);
  if (!session) return { status: 404 as const, body: { error: "Demo not found" } };

  const providerSettings = await getDemoProviderSettings(session.organization_id);
  if (!providerSettings.enable_voice_demo) {
    return { status: 403 as const, body: { error: "Voice demo is disabled." } };
  }

  const text = toDemoVoiceText(parsed.data.text);
  const audio = await synthesizeDemoSpeech(text);
  if (audio) {
    return {
      status: 200 as const,
      body: {
        text,
        audio_base64: audio.audioBase64,
        audio_mime_type: audio.mimeType,
        use_browser_tts: false,
      },
    };
  }

  return {
    status: 200 as const,
    body: {
      text,
      audio_base64: null,
      audio_mime_type: null,
      use_browser_tts: true,
    },
  };
}

const MAX_TRANSCRIBE_BYTES = 12 * 1024 * 1024;

export async function handleDemoTranscribe(
  sessionId: string,
  form: FormData | null
) {
  if (!form) {
    return { status: 400 as const, body: { error: "Expected multipart form with audio file." } };
  }

  const session = await getDemoSession(sessionId);
  if (!session) return { status: 404 as const, body: { error: "Demo not found" } };
  if (session.status === "completed" || session.status === "cancelled") {
    return { status: 400 as const, body: { error: "Demo has ended" } };
  }

  const providerSettings = await getDemoProviderSettings(session.organization_id);
  if (!providerSettings.enable_voice_demo) {
    return { status: 403 as const, body: { error: "Voice demo is disabled." } };
  }

  const file = form.get("audio");
  if (!(file instanceof Blob) || file.size === 0) {
    return { status: 400 as const, body: { error: "audio file is required" } };
  }
  if (file.size > MAX_TRANSCRIBE_BYTES) {
    return { status: 400 as const, body: { error: "Audio file too large (max 12MB)." } };
  }

  const displayName = String(form.get("display_name") ?? "").trim() || "Prospect";

  let transcript: string;
  let confidence: number | null = null;
  let language: string | null = null;

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || "audio/webm";
    const result = await transcribeDemoAudio({
      audioBuffer: buffer,
      mimeType,
      filename: file instanceof File ? file.name : undefined,
    });
    transcript = result.transcript;
    confidence = result.confidence;
    language = result.language;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Transcription failed";
    return { status: 502 as const, body: { error: message } };
  }

  if (providerSettings.enable_transcript) {
    await saveDemoTranscriptSegment({
      organizationId: session.organization_id,
      demoSessionId: sessionId,
      speaker: displayName,
      speakerType: "prospect",
      content: transcript,
      inputType: "voice",
      metadata: {
        confidence,
        language,
        source: "openai_whisper",
      },
    });
  }

  return {
    status: 200 as const,
    body: {
      transcript,
      confidence,
      language,
    },
  };
}

const transcriptBodySchema = z.object({
  speaker: z.string().max(80),
  speaker_type: z.enum(["prospect", "agent", "staff", "system"]).optional(),
  content: z.string().min(1).max(8000),
  input_type: z.enum(["text", "voice"]).default("text"),
  metadata: z.record(z.unknown()).optional(),
});

export async function handleDemoTranscriptAppend(sessionId: string, body: unknown) {
  const parsed = transcriptBodySchema.safeParse(body);
  if (!parsed.success) {
    return { status: 400 as const, body: { error: parsed.error.flatten() } };
  }

  const session = await getDemoSession(sessionId);
  if (!session) return { status: 404 as const, body: { error: "Demo not found" } };

  const segment = await saveDemoTranscriptSegment({
    organizationId: session.organization_id,
    demoSessionId: sessionId,
    speaker: parsed.data.speaker,
    speakerType: parsed.data.speaker_type ?? mapSenderToSpeakerType(parsed.data.speaker),
    content: parsed.data.content,
    inputType: parsed.data.input_type,
    metadata: parsed.data.metadata,
  });

  return { status: 200 as const, body: { segment } };
}

export async function handleDemoSummaryRefresh(sessionId: string) {
  const session = await getDemoSession(sessionId);
  if (!session) return { status: 404 as const, body: { error: "Demo not found" } };

  const transcript = await rebuildSessionTranscript(sessionId);
  const agent = session.agent_id ? await getAgent(session.agent_id) : null;
  const lead = session.lead_id ? await getLead(session.lead_id) : null;

  let aiSummary = "";
  try {
    aiSummary = await generateDemoSummaryFromTranscript({
      transcript,
      agentName: agent?.name ?? "AI Agent",
      companyName: agent?.company_product_name ?? undefined,
    });
  } catch {
    aiSummary = session.summary ?? "";
  }

  const summary = formatDemoSummaryText({
    session,
    lead,
    transcript,
    aiSummary,
    assetsViewed: Array.isArray(session.metadata?.assets_viewed)
      ? (session.metadata.assets_viewed as string[])
      : [],
  });

  await saveDemoSession({ ...session, summary, transcript });

  return { status: 200 as const, body: { summary, session: await getDemoSession(sessionId) } };
}
