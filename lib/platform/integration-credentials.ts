import type { IntegrationCredentialField } from "./settings-types";

export const INTEGRATION_CREDENTIAL_FIELDS: Record<string, IntegrationCredentialField[]> = {
  openai: [{ key: "api_key", label: "API key", type: "password", placeholder: "sk-..." }],
  whatsapp: [
    {
      key: "setup_note",
      label: "Configure in WhatsApp settings",
      type: "text",
      placeholder: "Integrations → WhatsApp",
    },
  ],
  google_calendar: [
    {
      key: "legacy_note",
      label: "Use OAuth on Calendar settings page",
      type: "text",
      placeholder: "Connect via Integrations → Google Calendar",
    },
  ],
  hubspot: [{ key: "access_token", label: "Private app token", type: "password" }],
  airtable: [
    { key: "api_key", label: "API key", type: "password" },
    { key: "base_id", label: "Base ID", type: "text" },
  ],
  google_sheets: [
    { key: "spreadsheet_id", label: "Spreadsheet ID", type: "text" },
    { key: "service_account_json", label: "Service account JSON", type: "password" },
  ],
  slack: [{ key: "webhook_url", label: "Incoming webhook URL", type: "password" }],
  email_smtp: [
    { key: "host", label: "SMTP host", type: "text" },
    { key: "port", label: "Port", type: "text" },
    { key: "user", label: "Username", type: "text" },
    { key: "password", label: "Password", type: "password" },
  ],
  zoom: [
    { key: "account_id", label: "Account ID", type: "text" },
    { key: "client_id", label: "Client ID", type: "text" },
    { key: "client_secret", label: "Client secret", type: "password" },
  ],
  website_chat: [{ key: "embed_agent_id", label: "Embed agent ID", type: "text" }],
  webhook_api: [{ key: "signing_secret", label: "Signing secret", type: "password" }],
};

export const INTEGRATION_TYPES = Object.keys(INTEGRATION_CREDENTIAL_FIELDS);
