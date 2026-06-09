"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  MessageSquare,
  Mic,
  Pause,
  Play,
  Shield,
  Sparkles,
  Volume2,
} from "lucide-react";
import styles from "./landing-agent-demo.module.css";

const STAGE_KEYS = [
  "discovery",
  "stack",
  "team",
  "budget",
  "close",
  "handoff",
] as const;

type DemoStage = (typeof STAGE_KEYS)[number];

type DemoTurn = {
  role: "assistant" | "user";
  stage: DemoStage;
  body: ReactNode;
  voiceInput?: boolean;
};

const DEMO_TURNS: DemoTurn[] = [
  {
    role: "assistant",
    stage: "discovery",
    body: (
      <>
        Thanks for reaching out. To tailor our approach — are you focusing more on{" "}
        <span className={styles.strong}>followers</span>,{" "}
        <span className={styles.strong}>engagement</span>, or{" "}
        <span className={styles.strong}>conversions</span>?
      </>
    ),
  },
  {
    role: "user",
    stage: "discovery",
    body: "Mostly conversions—we're running Meta ads but cost per lead is too high.",
    voiceInput: true,
  },
  {
    role: "assistant",
    stage: "discovery",
    body: (
      <>
        Understood — <span className={styles.strong}>conversions</span> first. What's
        your biggest <span className={styles.strong}>milestone for growth</span> in the
        next <span className={styles.strong}>6 months</span>?
      </>
    ),
  },
  {
    role: "user",
    stage: "discovery",
    body: "We want 40% more qualified leads and a clear paid social playbook.",
    voiceInput: true,
  },
  {
    role: "assistant",
    stage: "stack",
    body: (
      <>
        Great context. Which service pillar interests you:{" "}
        <span className={styles.strong}>Paid Ads</span>,{" "}
        <span className={styles.strong}>Social Media Management</span>, or{" "}
        <span className={styles.strong}>Digital Transformation</span>?
      </>
    ),
  },
  {
    role: "user",
    stage: "stack",
    body: "Paid Ads, but we might need help with creative too.",
    voiceInput: true,
  },
  {
    role: "assistant",
    stage: "stack",
    body: (
      <>
        Got it — <span className={styles.strong}>Paid Ads</span> with creative support.
        Are your ads <span className={styles.strong}>in-house</span>, or do you need{" "}
        <span className={styles.strong}>creative + media buying</span> support?
      </>
    ),
  },
  {
    role: "user",
    stage: "stack",
    body: "We need both—especially UGC-style creative for Meta.",
    voiceInput: true,
  },
];

const STAGE_LABELS: Record<DemoStage, string> = {
  discovery: "Discovery",
  stack: "Stack",
  team: "Team",
  budget: "Budget",
  close: "Close",
  handoff: "Handoff",
};

const TURN_INTERVAL_MS = 3200;

export function LandingAgentDemo() {
  const [visibleCount, setVisibleCount] = useState(1);
  const [audioMode, setAudioMode] = useState(false);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);

  const activeStage = useMemo(() => {
    const last = DEMO_TURNS[Math.min(visibleCount - 1, DEMO_TURNS.length - 1)];
    return last?.stage ?? "discovery";
  }, [visibleCount]);

  const activeStageIndex = STAGE_KEYS.indexOf(activeStage);
  const isComplete = visibleCount >= DEMO_TURNS.length;
  const showTyping =
    !isComplete && DEMO_TURNS[visibleCount]?.role === "assistant";

  const resetDemo = useCallback(() => {
    setVisibleCount(1);
    setPlayingIndex(null);
    setPaused(false);
  }, []);

  useEffect(() => {
    if (visibleCount >= DEMO_TURNS.length) return;
    const timer = window.setTimeout(() => {
      setVisibleCount((c) => c + 1);
    }, TURN_INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [visibleCount]);

  useEffect(() => {
    if (!audioMode) {
      setPlayingIndex(null);
      setPaused(false);
      return;
    }
    const lastIndex = visibleCount - 1;
    const lastTurn = DEMO_TURNS[lastIndex];
    if (lastTurn?.role === "assistant") {
      setPlayingIndex(lastIndex);
      setPaused(false);
    }
  }, [audioMode, visibleCount]);

  useEffect(() => {
    if (!audioMode || playingIndex == null || paused) return;
    const timer = window.setTimeout(() => setPlayingIndex(null), 2400);
    return () => window.clearTimeout(timer);
  }, [audioMode, playingIndex, paused]);

  const company = process.env.NEXT_PUBLIC_COMPANY_NAME ?? "Digital Ready Ltd";

  return (
    <div className={styles.demoShell} aria-label="ReadyBot sales agent demo">
      <div className={styles.chrome} aria-hidden>
        <span />
        <span />
        <span />
        <span className={styles.chromeTitle}>app.digisales.ai · live qualification</span>
      </div>

      <div className={styles.header}>
        <div className={styles.agentMeta}>
          <div className={styles.avatar} aria-hidden />
          <div>
            <span className={styles.agentName}>ReadyBot</span>
            <span className={styles.agentSub}>
              AI sales agent · {company}
            </span>
          </div>
        </div>
        <div className={styles.headerActions}>
          <span className={styles.liveBadge}>
            <span className={styles.liveDot} aria-hidden />
            Live demo
          </span>
          <div
            className={styles.modeToggle}
            role="group"
            aria-label="Response mode"
          >
            <button
              type="button"
              className={`${styles.modeBtn} ${!audioMode ? styles.modeBtnActive : ""}`}
              onClick={() => setAudioMode(false)}
              aria-pressed={!audioMode}
            >
              <MessageSquare size={13} aria-hidden />
              Text
            </button>
            <button
              type="button"
              className={`${styles.modeBtn} ${audioMode ? styles.modeBtnActive : ""}`}
              onClick={() => setAudioMode(true)}
              aria-pressed={audioMode}
            >
              <Volume2 size={13} aria-hidden />
              Audio
            </button>
          </div>
        </div>
      </div>

      <div
        className={styles.stageTrack}
        role="list"
        aria-label="Sales pipeline stages"
      >
        {STAGE_KEYS.map((key, i) => {
          const isActive = key === activeStage;
          const isDone = i < activeStageIndex;
          return (
            <div key={key} className={styles.stageNode} role="listitem">
              {i > 0 ? (
                <span
                  className={`${styles.stageConnector} ${isDone || isActive ? styles.stageConnectorDone : ""}`}
                  aria-hidden
                />
              ) : null}
              <span
                className={`${styles.stagePill} ${isActive ? styles.stagePillActive : ""} ${isDone ? styles.stagePillDone : ""}`}
                aria-current={isActive ? "step" : undefined}
              >
                {isActive ? <Sparkles size={11} aria-hidden /> : null}
                {STAGE_LABELS[key]}
              </span>
            </div>
          );
        })}
      </div>

      <div className={styles.transcript} aria-live="polite">
        {DEMO_TURNS.slice(0, visibleCount).map((turn, index) => (
          <div
            key={`${turn.role}-${index}`}
            className={`${styles.bubble} ${
              turn.role === "assistant" ? styles.bubbleAgent : styles.bubbleUser
            }`}
          >
            <div
              className={`${styles.bubbleLabel} ${
                turn.role === "assistant"
                  ? styles.bubbleLabelAgent
                  : styles.bubbleLabelUser
              }`}
            >
              <span>{turn.role === "assistant" ? "ReadyBot" : "Prospect"}</span>
              {turn.role === "assistant" && audioMode ? (
                <span className={styles.audioRow}>
                  <span
                    className={`${styles.audioBtn} ${
                      playingIndex === index && !paused
                        ? styles.audioBtnPlaying
                        : ""
                    }`}
                    aria-hidden
                  >
                    {playingIndex === index && !paused ? (
                      <Pause size={12} />
                    ) : (
                      <Play size={12} />
                    )}
                  </span>
                  <Volume2 size={12} aria-hidden />
                </span>
              ) : null}
              {turn.role === "user" && audioMode && turn.voiceInput ? (
                <span className={styles.voiceBadge}>
                  <Mic size={11} aria-hidden />
                  Voice
                </span>
              ) : null}
            </div>
            {turn.body}
          </div>
        ))}
        {showTyping ? (
          <div className={styles.typing} aria-label="ReadyBot is typing">
            <span />
            <span />
            <span />
          </div>
        ) : null}
      </div>

      <div className={styles.footer}>
        <span className={styles.footerHint}>
          <Shield size={13} aria-hidden />
          {audioMode
            ? "Bi-directional voice + text · policy-safe replies"
            : "One question per turn · approved knowledge only"}
        </span>
        <button type="button" className={styles.replayBtn} onClick={resetDemo}>
          Replay demo
        </button>
      </div>
    </div>
  );
}
