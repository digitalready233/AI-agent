/** Spoken lines for booking / handoff when the model output is too long. */
export function demoVoiceBookingPhrase(): string {
  return (
    "This looks like a good fit. The best next step is to book a quick consultation. " +
    "I've shown the booking option on your screen."
  );
}

export function demoVoiceHandoffPhrase(): string {
  return (
    "This needs a team member to assist you properly. I'm notifying the team now."
  );
}

export function applyDemoVoicePhrases(params: {
  text: string;
  handoffRequired: boolean;
  bookingRecommended: boolean;
}): string {
  if (params.handoffRequired) return demoVoiceHandoffPhrase();
  if (params.bookingRecommended) return demoVoiceBookingPhrase();
  return params.text;
}
