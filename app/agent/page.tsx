"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ChatWidget } from "@/components/ChatWidget";
import { LogoutButton } from "@/components/LogoutButton";
import styles from "./agent.module.css";

function AgentWorkspace() {
  const searchParams = useSearchParams();
  const agentId =
    searchParams.get("agentId")?.trim() ||
    process.env.NEXT_PUBLIC_PLATFORM_AGENT_ID?.trim() ||
    undefined;

  return (
    <div className={styles.shell}>
      <header className={styles.topBar}>
        <div className={styles.topLeft}>
          <span className={styles.mark} aria-hidden />
          <span className={styles.word}>DigiSales.ai</span>
          <span className={styles.badge}>
            <span className={styles.badgeDot} aria-hidden />
            Live agent
          </span>
        </div>
        <div className={styles.topRight}>
          <LogoutButton />
        </div>
      </header>
      <main className={styles.main}>
        <div className={styles.chatWrap}>
          <ChatWidget variant="workspace" platformAgentId={agentId} />
        </div>
      </main>
    </div>
  );
}

export default function AgentPage() {
  return (
    <Suspense fallback={<div className={styles.shell}>Loading…</div>}>
      <AgentWorkspace />
    </Suspense>
  );
}
