"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export const COOKIE_CONSENT_KEY = "digisales_cookie_consent_v1";

export type CookieConsentLevel = "all" | "essential";

export function getCookieConsent(): CookieConsentLevel | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(COOKIE_CONSENT_KEY);
  if (v === "all" || v === "essential") return v;
  return null;
}

function persistConsent(level: CookieConsentLevel) {
  localStorage.setItem(COOKIE_CONSENT_KEY, level);
  document.cookie = `${COOKIE_CONSENT_KEY}=${level}; path=/; max-age=31536000; SameSite=Lax`;
  window.dispatchEvent(
    new CustomEvent("digisales:cookie-consent", { detail: { level } })
  );
}

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!getCookieConsent()) setVisible(true);
  }, []);

  if (!visible) return null;

  function accept(level: CookieConsentLevel) {
    persistConsent(level);
    setVisible(false);
  }

  return (
    <div
      role="dialog"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-desc"
      className="fixed inset-x-0 bottom-0 z-[100] p-4 sm:p-6 pointer-events-none"
    >
      <div className="pointer-events-auto mx-auto max-w-3xl rounded-xl border border-[var(--border-strong)] bg-[var(--surface-glass)] backdrop-blur-md shadow-2xl shadow-black/40 p-4 sm:p-5">
        <p
          id="cookie-consent-title"
          className="text-sm font-semibold text-[var(--text)]"
        >
          Cookie preferences
        </p>
        <p
          id="cookie-consent-desc"
          className="mt-2 text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed"
        >
          We use essential cookies to keep you signed in and remember your choices.
          With your consent we may also use analytics cookies to improve DigiSales.ai.
          See our{" "}
          <Link
            href="/privacy#cookies"
            className="text-[var(--brand)] underline-offset-2 hover:underline"
          >
            cookie policy
          </Link>
          .
        </p>
        <div className="mt-4 flex flex-col-reverse sm:flex-row sm:flex-wrap gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-[var(--border-strong)] text-[var(--text-secondary)]"
            onClick={() => accept("essential")}
          >
            Essential only
          </Button>
          <Button
            type="button"
            size="sm"
            className="bg-[var(--brand)] text-[var(--bg-deep)] hover:opacity-90"
            onClick={() => accept("all")}
          >
            Accept all cookies
          </Button>
        </div>
      </div>
    </div>
  );
}
