export interface WhatsAppMessageTemplate {
  id: string;
  name: string;
  /** Meta-approved template name (snake_case) used in Graph API sends */
  meta_template_name?: string | null;
  language: string;
  category: "marketing" | "utility" | "authentication";
  status: "draft" | "pending_approval" | "approved";
  body_preview: string;
  created_at: string;
}

export interface WhatsAppTemplateSendParams {
  templateName: string;
  languageCode: string;
  bodyParameters?: string[];
}

export type WhatsAppConnectionStatusValue =
  | "not_connected"
  | "connected"
  | "error";

export interface WhatsAppSettings {
  organization_id: string;
  phone_number_id: string;
  waba_id: string | null;
  business_phone_number: string | null;
  default_agent_id: string | null;
  webhook_verify_token: string | null;
  webhook_callback_url: string | null;
  connection_status: WhatsAppConnectionStatusValue;
  last_tested_at: string | null;
  message_templates: WhatsAppMessageTemplate[];
  updated_at: string;
}

export interface WhatsAppCredentials {
  organizationId: string;
  accessToken: string;
  phoneNumberId: string;
  wabaId: string | null;
}

export interface InboundWhatsAppMessage {
  whatsappMessageId: string;
  fromPhone: string;
  phoneNumberId: string;
  text: string;
  customerName: string | null;
  timestamp: string;
  /** Set when the user tapped a ReadyBot reply button. */
  interactiveButtonId?: string | null;
}

export interface InboundUnsupportedWhatsAppMessage {
  whatsappMessageId: string;
  fromPhone: string;
  phoneNumberId: string;
  messageType: string;
  customerName: string | null;
  timestamp: string;
}

export interface WhatsAppConnectionStatus {
  configured: boolean;
  phone_number_id: string | null;
  waba_id: string | null;
  business_phone_number: string | null;
  default_agent_id: string | null;
  has_access_token: boolean;
  has_verify_token: boolean;
  webhook_url: string;
  webhook_url_alt: string;
  connection_status: WhatsAppConnectionStatusValue;
  last_tested_at: string | null;
}
