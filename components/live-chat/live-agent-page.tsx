"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { LiveAgentChat } from "@/components/live-chat/live-agent-chat";
import styles from "./live-agent-page.module.css";

function LiveAgentContent({
  agentId: agentIdProp,
  embed: embedProp,
}: {
  agentId?: string;
  embed?: boolean;
}) {
  const searchParams = useSearchParams();
  const agentId =
    agentIdProp?.trim() ||
    searchParams.get("agentId")?.trim() ||
    process.env.NEXT_PUBLIC_PLATFORM_AGENT_ID?.trim() ||
    "";

  const embed =
    embedProp ??
    (searchParams.get("embed") === "1" || searchParams.get("embed") === "true");

  if (!agentId) {
    return (
      <main className={embed ? styles.shellEmbed : styles.shell}>
        <div className={styles.errorCard}>
          <h1 className={styles.errorTitle}>Chat unavailable</h1>
          <p className={styles.errorText}>
            No agent is configured. Open{" "}
            <code>/live-agent/your-agent-id</code> or set{" "}
            <code>NEXT_PUBLIC_PLATFORM_AGENT_ID</code> in your environment.
          </p>
        </div>
      </main>
    );
  }

  if (embed) {
    return (
      <main className={styles.shellEmbed}>
        <LiveAgentChat agentId={agentId} embed />
      </main>
    );
  }

  return (
    <main className={styles.shell}>
      <div className={styles.pageIntro}>
        <p className={styles.pageEyebrow}>AI qualification session</p>
        <h1 className={styles.pageTitle}>Talk to our AI sales agent</h1>
        <p className={styles.pageSubtitle}>
          Your agent discovers needs, qualifies budget and timeline, recommends the
          next step, books a consultation, and notifies a human closer when the deal
          needs a person — not a generic support widget.
        </p>
      </div>
      <div className={styles.chatFrame}>
        <LiveAgentChat agentId={agentId} />
      </div>
      <footer className={styles.footer}>
        <p>
          Powered by DigiSales.ai · Your conversation may be reviewed by our team
          to improve your experience.
        </p>
      </footer>
    </main>
  );
}

export function LiveAgentPage({
  agentId,
  embed,
}: {
  agentId?: string;
  embed?: boolean;
}) {
  return (
    <Suspense
      fallback={
        <main className={embed ? styles.shellEmbed : styles.shell}>
          <p className={styles.loading}>Loading chat…</p>
        </main>
      }
    >
      <LiveAgentContent agentId={agentId} embed={embed} />
    </Suspense>
  );
}
