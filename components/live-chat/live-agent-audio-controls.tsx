"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./live-agent-audio-controls.module.css";

export function LiveAgentAudioControls({
  text,
  audioBase64,
  audioMimeType,
  autoPlay,
}: {
  text: string;
  audioBase64?: string | null;
  audioMimeType?: string | null;
  autoPlay?: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (audioBase64 && audioMimeType) {
      setSrc(`data:${audioMimeType};base64,${audioBase64}`);
    } else {
      setSrc(null);
    }
  }, [audioBase64, audioMimeType]);

  useEffect(() => {
    if (!autoPlay || !src) return;
    const audio = new Audio(src);
    audioRef.current = audio;
    setPlaying(true);
    audio.onended = () => setPlaying(false);
    audio.onerror = () => setPlaying(false);
    void audio.play().catch(() => setPlaying(false));
    return () => {
      audio.pause();
    };
  }, [autoPlay, src]);

  const togglePlay = useCallback(() => {
    if (!src) return;
    if (!audioRef.current) {
      audioRef.current = new Audio(src);
      audioRef.current.onended = () => setPlaying(false);
    }
    const audio = audioRef.current;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      void audio.play().then(() => setPlaying(true));
    }
  }, [playing, src]);

  const download = useCallback(() => {
    if (!src) return;
    const a = document.createElement("a");
    a.href = src;
    a.download = "readybot-response.mp3";
    a.click();
  }, [src]);

  if (!src) return null;

  return (
    <div className={styles.row} aria-label="AI audio playback">
      <button type="button" className={styles.btn} onClick={togglePlay}>
        {playing ? "Pause" : "Play"}
      </button>
      <button type="button" className={styles.btn} onClick={download}>
        Download
      </button>
      <span className={styles.hint} title={text}>
        Audio reply
      </span>
    </div>
  );
}
