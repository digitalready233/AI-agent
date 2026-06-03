/**

 * Twilio Media Stream ↔ OpenAI Realtime bridge.

 * Run via `npm run voice:ws` with VOICE_MEDIA_WS_PUBLIC_URL for production.

 */

import type WebSocket from "ws";

import { appendCallEvent, getCallById, saveCall } from "../call-data";

import { appendTranscriptLine } from "../call-summary";

import {

  buildRealtimeToolDefinitions,

  executeRealtimeVoiceTool,

  type RealtimeToolRunContext,

} from "../realtime-tools";

import { buildVoiceAgentInstructions, openAiRealtimeVoice } from "../voice-prompt";

import { getAgent } from "@/lib/platform/data";

import { getVoiceIntegration } from "../settings-data";



type StreamState = {

  organizationId: string;

  callId: string;

  streamSid: string | null;

  twilioCallSid: string | null;

  agentId: string | null;

  conversationId: string | null;

  leadId: string | null;

  callerPhone: string | null;

  sequence: number;

  openAiWs: WebSocket | null;

  appOrigin: string;

};



const activeStreams = new Map<string, StreamState>();



export async function handleTwilioMediaMessage(

  twilioWs: WebSocket,

  message: Record<string, unknown>

): Promise<void> {

  const event = message.event as string;



  if (event === "start") {

    const start = message.start as {

      streamSid?: string;

      callSid?: string;

      customParameters?: Record<string, string>;

    };

    const callId = start.customParameters?.callId ?? "";

    const organizationId = start.customParameters?.organizationId ?? "";

    const streamSid = start.streamSid ?? null;

    const twilioCallSid = start.callSid ?? null;



    const appOrigin =

      process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";



    const call = await getCallById(organizationId, callId);

    if (call && call.status === "ringing") {

      await saveCall({

        ...call,

        status: "in_progress",

        updated_at: new Date().toISOString(),

      });

    }



    const state: StreamState = {

      organizationId,

      callId,

      streamSid,

      twilioCallSid: twilioCallSid ?? call?.twilio_call_sid ?? null,

      agentId: call?.agent_id ?? null,

      conversationId: call?.conversation_id ?? null,

      leadId: call?.lead_id ?? null,

      callerPhone: call?.from_number ?? null,

      sequence: 0,

      openAiWs: null,

      appOrigin,

    };

    activeStreams.set(streamSid ?? callId, state);



    await appendCallEvent({

      organizationId,

      callId,

      eventType: "media_stream.start",

      payload: { streamSid, twilioCallSid: state.twilioCallSid },

    });



    if (process.env.OPENAI_API_KEY?.trim()) {

      void connectOpenAiRealtime(twilioWs, state).catch((err) => {

        console.error("[voice-ws] OpenAI connect failed", err);

        void appendCallEvent({

          organizationId,

          callId,

          eventType: "media_stream.error",

          payload: { error: String(err) },

        });

      });

    }

    return;

  }



  const streamSid = (message.streamSid as string) ?? "";

  const state =

    activeStreams.get(streamSid) ??

    [...activeStreams.values()].find((s) => s.streamSid === streamSid);



  if (!state) return;



  if (event === "media") {

    const media = message.media as { payload?: string };

    if (state.openAiWs?.readyState === 1 && media.payload) {

      state.openAiWs.send(

        JSON.stringify({

          type: "input_audio_buffer.append",

          audio: media.payload,

        })

      );

    }

    return;

  }



  if (event === "stop") {

    await appendCallEvent({

      organizationId: state.organizationId,

      callId: state.callId,

      eventType: "media_stream.stop",

      payload: {},

    });

    state.openAiWs?.close();

    activeStreams.delete(streamSid || state.callId);



    const { finalizeCallSummary } = await import("../call-summary");

    await finalizeCallSummary({

      organizationId: state.organizationId,

      callId: state.callId,

    });

  }

}



function toolContext(state: StreamState): RealtimeToolRunContext {

  return {

    organizationId: state.organizationId,

    agentId: state.agentId ?? "",

    callId: state.callId,

    conversationId: state.conversationId,

    leadId: state.leadId,

    callerPhone: state.callerPhone,

    appOrigin: state.appOrigin,

    twilioCallSid: state.twilioCallSid,

  };

}



async function handleFunctionCall(

  openAiWs: WebSocket,

  state: StreamState,

  evt: Record<string, unknown>

): Promise<void> {

  const callId = evt.call_id as string;

  const name = evt.name as string;

  const args = (evt.arguments as string) ?? "{}";



  const result = await executeRealtimeVoiceTool(toolContext(state), name, args);



  if (result.output.includes("leadId")) {

    try {

      const parsed = JSON.parse(result.output) as { leadId?: string };

      if (parsed.leadId) state.leadId = parsed.leadId;

    } catch {

      /* ignore */

    }

  }



  openAiWs.send(

    JSON.stringify({

      type: "conversation.item.create",

      item: {

        type: "function_call_output",

        call_id: callId,

        output: result.output,

      },

    })

  );

  openAiWs.send(JSON.stringify({ type: "response.create" }));

}



async function connectOpenAiRealtime(

  twilioWs: WebSocket,

  state: StreamState

): Promise<void> {

  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) return;



  const call = await getCallById(state.organizationId, state.callId);

  if (!call?.agent_id) return;



  state.agentId = call.agent_id;

  state.conversationId = call.conversation_id;

  state.leadId = call.lead_id;

  state.callerPhone = call.from_number;

  state.twilioCallSid = call.twilio_call_sid ?? state.twilioCallSid;



  const agent = await getAgent(call.agent_id);

  const integration = await getVoiceIntegration(

    state.organizationId,

    state.appOrigin

  );

  const instructions = await buildVoiceAgentInstructions({

    organizationId: state.organizationId,

    agentId: call.agent_id,

  });

  const voice = openAiRealtimeVoice(agent, integration.default_voice);

  const tools = buildRealtimeToolDefinitions();



  const { default: WS } = await import("ws");

  const openAiWs = new WS(

    "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview",

    {

      headers: {

        Authorization: `Bearer ${apiKey}`,

        "OpenAI-Beta": "realtime=v1",

      },

    }

  );



  state.openAiWs = openAiWs;



  openAiWs.on("open", () => {

    openAiWs.send(

      JSON.stringify({

        type: "session.update",

        session: {

          modalities: ["text", "audio"],

          instructions,

          voice,

          tools,

          tool_choice: "auto",

          input_audio_format: "g711_ulaw",

          output_audio_format: "g711_ulaw",

          input_audio_transcription: { model: "whisper-1" },

          turn_detection: { type: "server_vad" },

        },

      })

    );

  });



  openAiWs.on("message", (data) => {

    void (async () => {

      try {

        const evt = JSON.parse(data.toString()) as Record<string, unknown>;

        const type = evt.type as string;



        if (type === "response.audio.delta" && evt.delta) {

          twilioWs.send(

            JSON.stringify({

              event: "media",

              streamSid: state.streamSid,

              media: { payload: evt.delta },

            })

          );

        }



        if (type === "response.audio_transcript.done" && evt.transcript) {

          state.sequence += 1;

          await appendTranscriptLine({

            organizationId: state.organizationId,

            callId: state.callId,

            speaker: "agent",

            content: String(evt.transcript),

            sequenceNum: state.sequence,

          });

        }



        if (

          type === "conversation.item.input_audio_transcription.completed" &&

          (evt as { transcript?: string }).transcript

        ) {

          const transcript = (evt as { transcript?: string }).transcript!;

          state.sequence += 1;

          await appendTranscriptLine({

            organizationId: state.organizationId,

            callId: state.callId,

            speaker: "caller",

            content: transcript,

            sequenceNum: state.sequence,

          });

        }



        if (type === "response.function_call_arguments.done") {

          await handleFunctionCall(openAiWs, state, evt);

        }

      } catch {

        /* ignore parse errors */

      }

    })();

  });



  openAiWs.on("error", (err) => {

    console.error("[voice-ws] OpenAI error", err);

  });

}


