"use client";

import { useEffect } from "react";
import styles from "./live-agent-chat.module.css";

export function LiveAgentCalendlyPanel({
  embedUrl,
  customerName,
  customerEmail,
  onDismiss,
}: {
  embedUrl: string;
  customerName?: string;
  customerEmail?: string;
  onDismiss: () => void;
}) {
  const src = embedUrl;

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://assets.calendly.com/assets/external/widget.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return (
    <div className={styles.bookingPanel}>
      <div className={styles.bookingHeader}>
        <strong>Pick a time</strong>
        <button
          type="button"
          className={styles.bookingDismiss}
          onClick={onDismiss}
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
      <p className={styles.bookingMuted}>
        Choose a time below. We&apos;ll confirm your booking automatically.
      </p>
      <div
        className={styles.calendlyEmbed}
        data-url={src}
        style={{ minHeight: 520 }}
      >
        <iframe
          title="Schedule meeting"
          src={src}
          width="100%"
          height="520"
          frameBorder="0"
          style={{ border: 0, borderRadius: 8 }}
        />
      </div>
      {(customerName || customerEmail) && (
        <p className={styles.bookingMuted}>
          Booking as {customerName ?? "Guest"}
          {customerEmail ? ` (${customerEmail})` : ""}
        </p>
      )}
      <a
        href={src}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.bookingConfirm}
        style={{ display: "inline-block", textAlign: "center", marginTop: 8 }}
      >
        Open scheduler in new tab
      </a>
    </div>
  );
}
