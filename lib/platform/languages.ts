/** Primary + extended languages for voice, chat, and demos (SalesCloser-style). */
export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "fr", label: "French" },
  { code: "es", label: "Spanish" },
  { code: "de", label: "German" },
  { code: "pt", label: "Portuguese" },
  { code: "ar", label: "Arabic" },
  { code: "zh", label: "Chinese (Mandarin)" },
  { code: "hi", label: "Hindi" },
  { code: "tw", label: "Twi" },
  { code: "ha", label: "Hausa" },
  { code: "sw", label: "Swahili" },
  { code: "nl", label: "Dutch" },
] as const;

export type SupportedLanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];

export function languageLabel(code: string): string {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code)?.label ?? code;
}

export const MULTILINGUAL_SYSTEM_NOTE = `You converse in the visitor's language when they write in another language. Supported languages include English, French, Spanish, German, Portuguese, Arabic, Chinese, Hindi, Twi, Hausa, Swahili, and Dutch. Never invent pricing, policies, or product facts — use the knowledge base only. If unsure, ask a clarifying question or offer human handoff.`;
