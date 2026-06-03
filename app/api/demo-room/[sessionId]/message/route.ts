import { z } from "zod";

import { getAgent, getLead } from "@/lib/platform/data";

import { hasServiceRoleKey, withPlatformAdmin } from "@/lib/platform/db";

import { isDemoRoomAiEnabled } from "@/lib/demo/config";

import { getDemoSession } from "@/lib/demo/demo-data";

import { buildDemoSafeFallbackResponse } from "@/lib/demo/demo-fallback";

import { runDemoStage1PlaceholderTurn } from "@/lib/demo/stage1-chat";

import { runDemoWorkflow } from "@/lib/demo/run-demo-workflow";

import { WorkflowError } from "@/lib/platform/workflow/types";



const bodySchema = z.object({

  message: z.string().min(1).max(8000),

  display_name: z.string().max(120).optional(),

  email: z.string().email().optional(),

  phone: z.string().max(40).optional(),

  current_demo_asset_id: z.string().uuid().optional(),

});



export async function POST(

  req: Request,

  { params }: { params: Promise<{ sessionId: string }> }

) {

  if (!hasServiceRoleKey()) {

    return Response.json({ error: "Demo room not configured." }, { status: 503 });

  }



  const { sessionId } = await params;

  const parsed = bodySchema.safeParse(await req.json());

  if (!parsed.success) {

    return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  }



  return withPlatformAdmin(async () => {

    const session = await getDemoSession(sessionId);

    if (!session) {

      return Response.json({ error: "Demo not found" }, { status: 404 });

    }

    if (session.status === "completed" || session.status === "cancelled") {

      return Response.json({ error: "Demo has ended" }, { status: 400 });

    }



    const agent = session.agent_id ? await getAgent(session.agent_id) : null;

    if (!agent?.enabled) {

      return Response.json({ error: "Demo not available" }, { status: 404 });

    }



    try {

      if (!isDemoRoomAiEnabled()) {

        const result = await runDemoStage1PlaceholderTurn({

          demoSessionId: sessionId,

          customerMessage: parsed.data.message,

          displayName: parsed.data.display_name,

          email: parsed.data.email,

        });

        return Response.json({

          reply: result.reply,

          current_demo_stage: result.current_demo_stage,

          booking_recommended: result.booking_recommended,

          handoff_required: result.handoff_required,

          next_asset: result.next_asset,

          stage1_placeholder: true,

        });

      }



      let scheduledLeadContext: string | undefined;
      if (session.lead_id && session.entry_mode !== "on_demand") {
        const lead = await getLead(session.lead_id);
        if (lead) {
          scheduledLeadContext = [
            lead.full_name && `Name: ${lead.full_name}`,
            lead.business_name && `Business: ${lead.business_name}`,
            lead.service_interest && `Interest: ${lead.service_interest}`,
            lead.budget && `Budget: ${lead.budget}`,
            lead.timeline && `Timeline: ${lead.timeline}`,
          ]
            .filter(Boolean)
            .join("\n");
        }
      }

      const result = await runDemoWorkflow({
        organizationId: session.organization_id,
        demoSessionId: sessionId,
        agentId: agent.id,
        leadId: session.lead_id,
        customerMessage: parsed.data.message,
        currentDemoStep: session.current_demo_stage,
        currentDemoAssetId:
          parsed.data.current_demo_asset_id ??
          session.current_demo_asset_id ??
          (typeof session.metadata?.last_asset_id === "string"
            ? session.metadata.last_asset_id
            : null),
        scheduledLeadContext,
        channel: "demo_call",

        customerMetadata: {

          name: parsed.data.display_name,

          email: parsed.data.email,

          phone: parsed.data.phone,

        },

        inputType: "text",

        participantRole: "prospect",

      });



      return Response.json({
        reply: result.aiResponse,
        demo_stage: result.demoStage,
        current_demo_stage: result.currentDemoStage,
        selected_demo_path_id: result.selectedDemoPathId,
        selected_demo_path_title: result.selectedDemoPathTitle,
        current_demo_asset_id: result.currentDemoAssetId,
        detected_intent: result.detectedIntent,
        lead_score: result.leadScore,
        lead_category: result.leadCategory,
        lead_category_label: result.structured?.leadCategory,
        booking_recommended: result.bookingRecommended,
        handoff_required: result.handoffRequired,
        recommended_next_action: result.recommendedNextAction,
        summary_update: result.demoSummaryUpdate ?? result.structured?.demoSummaryUpdate,
        qualification_progress: result.qualificationProgress,
        objections: result.objections,
        structured: result.structured,
        lead_updates: result.structured?.leadUpdates,
        used_fallback: result.usedFallback ?? false,
        retryable: false,
        ai_paused: result.aiPaused ?? false,
        human_takeover_active:
          result.aiPaused ?? result.humanTakeoverActive ?? false,
        next_asset: result.nextDemoAsset
          ? {
              id: result.nextDemoAsset.id,
              title: result.nextDemoAsset.title,
              content: result.nextDemoAsset.content,
              asset_type: result.nextDemoAsset.asset_type,
            }
          : null,
      });

    } catch (err) {

      if (err instanceof WorkflowError) {

        const retryable =

          err.code === "LLM_REQUEST_FAILED" ||

          err.code === "ANALYSIS_FAILED" ||

          err.statusCode === 502 ||

          err.statusCode === 503;

        console.error("[demo-room/message] WorkflowError", {

          sessionId,

          code: err.code,

          message: err.message,

        });

        return Response.json(

          {

            error: err.message,

            code: err.code,

            retryable,

            fallback_reply: retryable

              ? buildDemoSafeFallbackResponse({ reason: "llm_error", handoffSuggested: true })

              : undefined,

          },

          { status: err.statusCode }

        );

      }

      console.error("[demo-room/message]", err);

      return Response.json(

        {

          error: "Could not process message. Please try again.",

          retryable: true,

          fallback_reply: buildDemoSafeFallbackResponse({

            reason: "llm_error",

            handoffSuggested: true,

          }),

        },

        { status: 500 }

      );

    }

  });

}


