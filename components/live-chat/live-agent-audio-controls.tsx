"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, Volume2 } from "lucide-react";
import styles from "./live-agent-audio-controls.module.css";

const WAVEFORM_BARS = [3, 5, 8, 4, 7, 9, 5, 6, 8, 4, 7, 5];

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

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
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [src, setSrc] = useState<string | null>(null);
  const [useSpeechFallback, setUseSpeechFallback] = useState(false);

  useEffect(() => {
    if (audioBase64 && audioMimeType) {
      setSrc(`data:${audioMimeType};base64,${audioBase64}`);
      setUseSpeechFallback(false);
    } else {
      setSrc(null);
      setUseSpeechFallback(Boolean(text.trim() && typeof window !== "undefined" && window.speechSynthesis));
    }
  }, [audioBase64, audioMimeType, text]);

  const estimatedDuration = useMemo(() => {
    if (duration > 0) return duration;
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(2, Math.min(45, words * 0.38));
  }, [duration, text]);

  useEffect(() => {
    if (!autoPlay) return;
    if (src) {
      const audio = new Audio(src);
      audioRef.current = audio;
      audio.onloadedmetadata = () => setDuration(audio.duration);
      audio.ontimeupdate = () => setCurrentTime(audio.currentTime);
      audio.onended = () => {
        setPlaying(false);
        setCurrentTime(0);
      };
      audio.onerror = () => setPlaying(false);
      setPlaying(true);
      void audio.play().catch(() => setPlaying(false));
      return () => audio.pause();
    }
    if (useSpeechFallback && text.trim()) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utteranceRef.current = utterance;
      utterance.onstart = () => {
        setPlaying(true);
        setDuration(estimatedDuration);
      };
      utterance.onend = () => {
        setPlaying(false);
        setCurrentTime(0);
      };
      utterance.onerror = () => setPlaying(false);
      window.speechSynthesis.speak(utterance);
      return () => window.speechSynthesis.cancel();
    }
  }, [autoPlay, estimatedDuration, src, text, useSpeechFallback]);

  const stopAll = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (typeof window !== "undefined") {
      window.speechSynthesis.cancel();
    }
    setPlaying(false);
    setCurrentTime(0);
  }, []);

  const togglePlay = useCallback(() => {
    if (src) {
      if (!audioRef.current) {
        const audio = new Audio(src);
        audioRef.current = audio;
        audio.onloadedmetadata = () => setDuration(audio.duration);
        audio.ontimeupdate = () => setCurrentTime(audio.currentTime);
        audio.onended = () => {
          setPlaying(false);
          setCurrentTime(0);
        };
        audio.onerror = () => setPlaying(false);
      }
      const audio = audioRef.current;
      if (playing) {
        audio.pause();
        setPlaying(false);
      } else {
        void audio.play().then(() => setPlaying(true));
      }
      return;
    }

    if (useSpeechFallback && text.trim()) {
      if (playing) {
        window.speechSynthesis.cancel();
        setPlaying(false);
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utteranceRef.current = utterance;
      utterance.onstart = () => {
        setPlaying(true);
        setDuration(estimatedDuration);
      };
      utterance.onend = () => {
        setPlaying(false);
        setCurrentTime(0);
      };
      utterance.onerror = () => setPlaying(false);
      window.speechSynthesis.speak(utterance);
    }
  }, [estimatedDuration, playing, src, text, useSpeechFallback]);

  useEffect(() => {
    return () => stopAll();
  }, [stopAll]);

  useEffect(() => {
    if (!playing || !useSpeechFallback || src) return;
    const start = Date.now();
    const tick = window.setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;
      setCurrentTime(Math.min(elapsed, estimatedDuration));
    }, 120);
    return () => window.clearInterval(tick);
  }, [estimatedDuration, playing, src, useSpeechFallback]);

  if (!src && !useSpeechFallback) return null;

  const displayDuration = duration > 0 ? duration : estimatedDuration;
  const progress =
    displayDuration > 0 ? Math.min(100, (currentTime / displayDuration) * 100) : 0;

  return (
    <div className={styles.player} aria-label="AI audio playback">
      <button
        type="button"
        className={styles.playBtn}
        onClick={togglePlay}
        aria-label={playing ? "Pause audio" : "Play audio"}
      >
        {playing ? <Pause size={14} aria-hidden /> : <Play size={14} aria-hidden />}
      </button>
      <div className={styles.waveform} aria-hidden>
        {WAVEFORM_BARS.map((h, i) => (
          <span
            key={i}
            className={playing ? styles.barActive : styles.bar}
            style={{ height: `${h * 3}px`, animationDelay: `${i * 0.06}s` }}
          />
        ))}
      </div>
      <div className={styles.meta}>
        <Volume2 size={12} aria-hidden />
        <span className={styles.time}>
          {formatDuration(currentTime)} / {formatDuration(displayDuration)}
        </span>
      </div>
      <div className={styles.progressTrack} aria-hidden>
        <span className={styles.progressFill} style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
