export interface CalendlyInviteePayload {
  uri: string;
  email: string;
  name: string;
  cancel_url?: string;
  reschedule_url?: string;
  questions_and_answers?: { question: string; answer: string }[];
  tracking?: {
    utm_campaign?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_content?: string;
    utm_term?: string;
    salesforce_uuid?: string;
  };
}

export interface CalendlyWebhookEvent {
  event: "invitee.created" | "invitee.canceled";
  created_at: string;
  payload: {
    uri?: string;
    cancel_url?: string;
    email?: string;
    name?: string;
    event?: string;
    scheduled_event?: {
      uri?: string;
      name?: string;
      start_time?: string;
      end_time?: string;
      location?: { join_url?: string; type?: string };
    };
    invitee?: CalendlyInviteePayload;
  };
}
