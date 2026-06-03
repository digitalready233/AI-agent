"use client";

import Link from "next/link";
import { SessionAvatar } from "@/components/avatar/SessionAvatar";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./voice.module.css";

type Msg = { role: "user" | "assistant"; content: string };

function getVoiceSessionId(): string {
  const key = "digisales_voice_session";
  if (typeof sessionStorage === "undefined") return `voice_web_${Date.now()}`;
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = `sess_${crypto.randomUUID()}`;
    sessionStorage.setItem(key, id);
  }
  return id;
}

export default function VoicePage() {
  const [speechOk, setSpeechOk] = useState<boolean | null>(null);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const messagesRef = useRef<Msg[]>([]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ok = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    setSpeechOk(ok);
  }, []);

  const sendText = useCallback(async (content: string, prior: Msg[]) => {
    const trimmed = content.trim();
    if (!trimmed) return;
    setError(null);
    const userMsg: Msg = { role: "user", content: trimmed };
    const history = [...prior, userMsg];
    setMessages(history);
    try {
      const res = await fetch("/api/voice/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          sessionId: getVoiceSessionId(),
          channel: "voice",
          role: "unified",
        }),
      });
      const data = (await res.json()) as { text?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Assistant unavailable.");
      const assistantText = data.text ?? "";
      setMessages((m) => [...m, { role: "assistant", content: assistantText }]);
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(assistantText);
        u.rate = 1;
        window.speechSynthesis.speak(u);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setMessages((m) => m.slice(0, -1));
    }
  }, []);

  const startListen = useCallback(() => {
    if (typeof window === "undefined") return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    recognitionRef.current?.stop();
    setTranscript("");
    setError(null);
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (ev: SpeechRecognitionEvent) => {
      let interim = "";
      let final = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        const t = r[0]?.transcript ?? "";
        if (r.isFinal) final += t;
        else interim += t;
      }
      const line = final || interim;
      setTranscript(line);
      if (final.trim()) {
        void sendText(final.trim(), messagesRef.current);
        setTranscript("");
      }
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  }, [sendText]);

  const stopListen = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <h1 className={`${styles.title} font-display`}>Browser voice agent</h1>
        <p className={styles.lead}>
          Speak naturally; your words go to the same DigiSales agent as chat and
          phone. Pair with a video avatar when{" "}
          <code>NEXT_PUBLIC_AVATAR_EMBED_URL</code> is set.
        </p>
      </header>

      <div className={styles.stage}>
        <div className={styles.avatarSlot}>
          <SessionAvatar />
        </div>

        <div className={styles.panel}>
          {speechOk === false ? (
            <p className={styles.error}>
              Speech recognition is not available in this browser. Try Chrome
              or Edge, or use the phone line / ConversationRelay path.
            </p>
          ) : null}
          <div className={styles.transcript}>
            {listening
              ? transcript || "Listening…"
              : transcript || "Tap the mic and speak."}
          </div>
          <div className={styles.actions}>
            {!listening ? (
              <button
                type="button"
                className={styles.mic}
                onClick={startListen}
                disabled={speechOk === false}
              >
                Start speaking
              </button>
            ) : (
              <button
                type="button"
                className={`${styles.mic} ${styles.micActive}`}
                onClick={stopListen}
              >
                Stop
              </button>
            )}
            <span className={styles.hint}>
              Replies play via your device speakers (speech synthesis).
            </span>
          </div>
          {error ? <p className={styles.error}>{error}</p> : null}
          {messages.length > 0 ? (
            <div className={styles.log} aria-live="polite">
              {messages.map((m, i) => (
                <div
                  key={`${i}-${m.role}`}
                  className={m.role === "user" ? styles.msgUser : styles.msgAssistant}
                >
                  <strong>{m.role === "user" ? "You" : "Agent"}:</strong> {m.content}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <p className={styles.back}>
        <Link href="/">← Back to home</Link>
      </p>
    </div>
  );
}
