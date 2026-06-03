export type RecaptchaAction = "login" | "register" | "password_reset" | "google_oauth";

const VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";

export function getRecaptchaSiteKey(): string | null {
  return process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim() || null;
}

/** Client-safe: true when the browser should load reCAPTCHA. */
export function isRecaptchaClientEnabled(): boolean {
  return Boolean(getRecaptchaSiteKey());
}

export function isRecaptchaConfigured(): boolean {
  return Boolean(getRecaptchaSiteKey() && process.env.RECAPTCHA_SECRET_KEY?.trim());
}

/** When true, auth endpoints reject requests without a valid token. */
export function isRecaptchaEnforced(): boolean {
  if (!isRecaptchaConfigured()) return false;
  if (process.env.RECAPTCHA_ENFORCE === "false") return false;
  if (process.env.RECAPTCHA_ENFORCE === "true") return true;
  return process.env.NODE_ENV === "production";
}

type VerifyResponse = {
  success: boolean;
  score?: number;
  action?: string;
  "error-codes"?: string[];
};

export async function verifyRecaptchaToken(
  token: string | undefined | null,
  expectedAction: RecaptchaAction
): Promise<{ ok: true; score: number } | { ok: false; error: string }> {
  if (!isRecaptchaEnforced()) {
    return { ok: true, score: 1 };
  }

  const secret = process.env.RECAPTCHA_SECRET_KEY?.trim();
  const siteKey = getRecaptchaSiteKey();
  if (!secret || !siteKey) {
    return { ok: false, error: "Security verification is not configured." };
  }

  if (!token?.trim()) {
    return { ok: false, error: "Security verification failed. Please try again." };
  }

  const minScore = Number(process.env.RECAPTCHA_MIN_SCORE ?? "0.5");
  const body = new URLSearchParams({
    secret,
    response: token.trim(),
  });

  const res = await fetch(VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    return { ok: false, error: "Could not verify security check." };
  }

  const data = (await res.json()) as VerifyResponse;
  if (!data.success) {
    return { ok: false, error: "Security verification failed. Please try again." };
  }

  if (data.action && data.action !== expectedAction) {
    return { ok: false, error: "Invalid security verification action." };
  }

  const score = typeof data.score === "number" ? data.score : 0;
  if (score < minScore) {
    return { ok: false, error: "Security check score too low. Please try again." };
  }

  return { ok: true, score };
}
