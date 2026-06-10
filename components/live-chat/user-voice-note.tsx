"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Pause, Play } from "lucide-react";
import styles from "./user-voice-note.module.css";

const WAVEFORM_BARS = [3, 6, 4, 8, 5, 9, 4, 7, 10, 5, 8, 6, 4, 9, 7, 5, 8, 4, 6, 7];

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function UserVoiceNote({
  audioUrl,
  durationSec = 0,
  transcript,
  playable = true,
}: {
  audioUrl?: string | null;
  durationSec?: number;
  transcript: string;
  playable?: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [loadedDuration, setLoadedDuration] = useState(durationSec);

  const displayDuration = loadedDuration > 0 ? loadedDuration : durationSec;

  useEffect(() => {
    setLoadedDuration(durationSec);
  }, [durationSec]);

  const stopPlayback = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlaying(false);
    setCurrentTime(0);
  }, []);

  useEffect(() => {
    return () => stopPlayback();
  }, [stopPlayback]);

  const togglePlay = useCallback(() => {
    if (!audioUrl || !playable) return;

    if (!audioRef.current) {
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.onloadedmetadata = () => {
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
          setLoadedDuration(audio.duration);
        }
      };
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
  }, [audioUrl, playable, playing]);

  const showTime = playing
    ? formatDuration(currentTime)
    : formatDuration(displayDuration);

  return (
    <div className={styles.wrap}>
      <div className={styles.player} aria-label="Voice message">
        <button
          type="button"
          className={styles.playBtn}
          onClick={togglePlay}
          disabled={!audioUrl || !playable}
          aria-label={
            !audioUrl
              ? "Voice message"
              : playing
                ? "Pause voice message"
                : "Play voice message"
          }
        >
          {!audioUrl ? (
            <Mic size={16} aria-hidden />
          ) : playing ? (
            <Pause size={16} aria-hidden />
          ) : (
            <Play size={16} aria-hidden style={{ marginLeft: 2 }} />
          )}
        </button>
        <div className={styles.waveform} aria-hidden>
          {WAVEFORM_BARS.map((h, i) => (
            <span
              key={i}
              className={playing ? styles.barActive : styles.bar}
              style={{
                height: `${h * 2.5}px`,
                animationDelay: `${i * 0.05}s`,
              }}
            />
          ))}
        </div>
        <span className={styles.duration}>{showTime}</span>
      </div>
      {transcript.trim() ? (
        <p className={styles.transcript}>
          <span className={styles.transcriptLabel}>Transcribed</span>
          {transcript.trim()}
        </p>
      ) : null}
    </div>
  );
}
