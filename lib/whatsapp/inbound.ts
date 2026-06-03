import { isLlmConfigured } from "@/lib/agent/llm-env";
import {
  findOrCreateConversationBySession,
  getAgent,
  getConversation,
  listAgents,
  messageExistsByWhatsAppId,
  saveConversation,
} from "@/lib/platform/data";
import { withPlatformAdmin } from "@/lib/platform/db";
import { handleCampaignInboundReply } from "@/lib/platform/campaign-reply-handler";
import { runAgentWorkflow, WorkflowError } from "@/lib/platform/workflow";
import { resolveWhatsAppCredentials } from "./credentials";
import { tryWhatsAppBookingFollowUp } from "./booking-followup";
import {
  markWhatsAppMessageRead,
  sendWhatsAppInteractiveButtons,
  sendWhatsAppTextMessage,
} from "./client";
import {
  mergeReadybotButtonsSent,
  readybotWhatsAppInteractiveFollowUp,
} from "./readybot-interactive";
import {
  findOrganizationByPhoneNumberId,
  getWhatsAppSettings,
} from "./settings-data";
import type { InboundWhatsAppMessage } from "./types";

function sessionIdForPhone(phone: string): string {
  return `wa_${phone.replace(/\D/g, "")}`;
}

async function resolveDefaultAgentId(
  organizationId: string,
  preferredAgentId: string | null
): Promise<string | null> {
  if (preferredAgentId) {
    const agent = await getAgent(preferredAgentId);
    if (agent?.enabled && agent.organization_id === organizationId) {
      return agent.id;
    }
  }

  const envAgent =
    process.env.WHATSAPP_DEFAULT_AGENT_ID?.trim() ||
    process.env.PLATFORM_AGENT_ID?.trim();
  if (envAgent) {
    const agent = await getAgent(envAgent);
    if (agent?.enabled && agent.organization_id === organizationId) {
      return agent.id;
    }
  }

  const agents = await listAgents(organizationId);
  const whatsappAgent = agents.find(
    (a) => a.enabled && a.channels?.includes("whatsapp")
  );
  if (whatsappAgent) return whatsappAgent.id;

  const anyEnabled = agents.find((a) => a.enabled);
  return anyEnabled?.id ?? null;
}

export async function processInboundWhatsAppMessage(
  inbound: InboundWhatsAppMessage
): Promise<{ status: "ok" | "ignored" | "error"; reason?: string }> {
  const logCtx = {
    wamid: inbound.whatsappMessageId,
    from: inbound.fromPhone,
    phoneNumberId: inbound.phoneNumberId,
  };

  console.info("[whatsapp] inbound", logCtx);

  const orgSettings = await findOrganizationByPhoneNumberId(inbound.phoneNumberId);
  if (!orgSettings?.organization_id) {
    console.warn("[whatsapp] unknown phone_number_id", logCtx);
    return { status: "ignored", reason: "unknown_phone_number_id" };
  }

  const organizationId = orgSettings.organization_id;
  const settings = await getWhatsAppSettings(organizationId);

  const credentials = await resolveWhatsAppCredentials({
    organizationId,
    phoneNumberId: inbound.phoneNumberId,
    wabaId: settings.waba_id,
  });

  if (!credentials) {
    console.error("[whatsapp] missing access token", { organizationId });
    return { status: "error", reason: "not_configured" };
  }

  if (!isLlmConfigured()) {
    console.error("[whatsapp] LLM not configured");
    await sendWhatsAppTextMessage({
      credentials,
      toPhone: inbound.fromPhone,
      body: "Our assistant is temporarily unavailable. Please try again shortly.",
    });
    return { status: "error", reason: "llm_not_configured" };
  }

  const agentId = await resolveDefaultAgentId(
    organizationId,
    settings.default_agent_id
  );
  if (!agentId) {
    console.error("[whatsapp] no enabled agent", { organizationId });
    return { status: "error", reason: "no_agent" };
  }

  try {
    return await withPlatformAdmin(async () => {
      const sessionId = sessionIdForPhone(inbound.fromPhone);
      let conversation = await findOrCreateConversationBySession({
        organizationId,
        agentId,
        sessionId,
        channel: "whatsapp",
      });

      if (await messageExistsByWhatsAppId(inbound.whatsappMessageId)) {
        console.info("[whatsapp] duplicate message skipped", logCtx);
        return { status: "ignored", reason: "duplicate" };
      }

      if (
        inbound.customerName &&
        !conversation.customer_name
      ) {
        conversation = await saveConversation({
          ...conversation,
          customer_name: inbound.customerName,
          customer_phone: inbound.fromPhone,
          updated_at: new Date().toISOString(),
        });
      } else if (!conversation.customer_phone) {
        conversation = await saveConversation({
          ...conversation,
          customer_phone: inbound.fromPhone,
          updated_at: new Date().toISOString(),
        });
      }

      void markWhatsAppMessageRead({
        credentials,
        whatsappMessageId: inbound.whatsappMessageId,
      });

      let result;
      try {
        result = await runAgentWorkflow({
          organizationId,
          agentId,
          conversationId: conversation.id,
          customerMessage: inbound.text,
          channel: "whatsapp",
          externalMessageId: inbound.whatsappMessageId,
          customerMetadata: {
            name: inbound.customerName ?? conversation.customer_name ?? undefined,
            phone: inbound.fromPhone,
          },
        });
      } catch (err) {
        if (err instanceof WorkflowError) {
          console.error("[whatsapp] workflow error", {
            ...logCtx,
            code: err.code,
            message: err.message,
          });
          const fallback =
            "Thanks for your message. We're having a brief technical issue — a team member will follow up soon.";
          await sendWhatsAppTextMessage({
            credentials,
            toPhone: inbound.fromPhone,
            body: fallback,
          });
          return { status: "error", reason: err.code };
        }
        throw err;
      }

      let outbound =
        result.handoffRequired && result.handoffVisitorMessage?.trim()
          ? result.handoffVisitorMessage.trim()
          : result.aiResponse.trim();

      if (!result.handoffRequired) {
        try {
          const bookingExtra = await tryWhatsAppBookingFollowUp({
            organizationId,
            agentId,
            conversation,
            customerMessage: inbound.text,
            workflow: result,
          });
          if (bookingExtra) {
            outbound = `${outbound}${bookingExtra}`.trim();
          }
        } catch (bookErr) {
          console.error("[whatsapp] booking follow-up failed", {
            ...logCtx,
            conversationId: conversation.id,
            error: bookErr,
          });
        }
      }

      const sendRes = await sendWhatsAppTextMessage({
        credentials,
        toPhone: inbound.fromPhone,
        body: outbound,
      });

      if (!sendRes.ok) {
        console.error("[whatsapp] outbound send failed", {
          ...logCtx,
          error: sendRes.error,
        });
        return { status: "error", reason: "send_failed" };
      }

      const agent = await getAgent(agentId);
      const freshConversation =
        (await getConversation(conversation.id)) ?? conversation;

      if (agent) {
        const followUp = readybotWhatsAppInteractiveFollowUp({
          agent,
          conversation: freshConversation,
          stage: result.conversationStage,
          handoffRequired: result.handoffRequired,
        });

        if (followUp) {
          const interactiveRes = await sendWhatsAppInteractiveButtons({
            credentials,
            toPhone: inbound.fromPhone,
            body: followUp.body,
            buttons: followUp.buttons,
          });

          if (interactiveRes.ok) {
            await saveConversation({
              ...freshConversation,
              metadata: mergeReadybotButtonsSent(
                freshConversation.metadata ?? undefined,
                followUp.metaKey
              ),
              updated_at: new Date().toISOString(),
            });
          } else {
            console.warn("[whatsapp] interactive buttons not sent", {
              ...logCtx,
              error: interactiveRes.error,
            });
          }
        }
      }

      if (result.leadId) {
        try {
          await handleCampaignInboundReply({
            organizationId,
            leadId: result.leadId,
            messageText: inbound.text,
          });
        } catch (campaignErr) {
          console.error("[whatsapp] campaign reply handler failed", {
            ...logCtx,
            leadId: result.leadId,
            error: campaignErr,
          });
        }
      }

      console.info("[whatsapp] conversation handled", {
        ...logCtx,
        conversationId: conversation.id,
        leadId: result.leadId,
        handoff: result.handoffRequired,
        intent: result.detectedIntent,
      });

      return { status: "ok" };
    });
  } catch (err) {
    console.error("[whatsapp] processInbound failed", logCtx, err);
    return { status: "error", reason: "internal" };
  }
}
