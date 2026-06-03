"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type DemoLiveKitStatus =
  | "idle"
  | "unavailable"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "error";

type LiveKitCredentials = {
  url: string;
  token: string;
  room_name: string;
};

export function useDemoLivekit(opts: {
  sessionId: string;
  enabled: boolean;
  displayName: string;
  role?: "prospect" | "staff";
}) {
  const { sessionId, enabled, displayName, role = "prospect" } = opts;
  const [status, setStatus] = useState<DemoLiveKitStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [participantCount, setParticipantCount] = useState(0);
  const roomRef = useRef<import("livekit-client").Room | null>(null);
  const connectingRef = useRef(false);

  const disconnect = useCallback(async () => {
    const room = roomRef.current;
    roomRef.current = null;
    connectingRef.current = false;
    if (room) {
      try {
        await room.disconnect();
      } catch {
        /* ignore */
      }
    }
    setParticipantCount(0);
    setStatus((s) => (s === "unavailable" ? "unavailable" : "disconnected"));
  }, []);

  const connect = useCallback(async () => {
    if (!enabled || !sessionId) {
      setStatus("unavailable");
      return;
    }
    if (connectingRef.current || roomRef.current) return;

    connectingRef.current = true;
    setError(null);
    setStatus("connecting");

    try {
      const res = await fetch(`/api/demo/sessions/${sessionId}/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: displayName.trim() || "Guest",
          role,
          identity: `${role}-${sessionId.slice(0, 8)}-${Date.now()}`,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        livekit?: LiveKitCredentials | null;
        internal_mode?: boolean;
      };

      if (!res.ok) {
        throw new Error(data.error ?? "Could not get realtime token");
      }

      if (!data.livekit?.url || !data.livekit.token) {
        setStatus("unavailable");
        connectingRef.current = false;
        return;
      }

      const { Room, RoomEvent, ConnectionState } = await import("livekit-client");
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      room.on(RoomEvent.ConnectionStateChanged, (state) => {
        if (state === ConnectionState.Connected) setStatus("connected");
        else if (state === ConnectionState.Reconnecting) setStatus("reconnecting");
        else if (state === ConnectionState.Disconnected) setStatus("disconnected");
      });

      room.on(RoomEvent.ParticipantConnected, () => {
        setParticipantCount(room.numParticipants);
      });
      room.on(RoomEvent.ParticipantDisconnected, () => {
        setParticipantCount(room.numParticipants);
      });

      await room.connect(data.livekit.url, data.livekit.token, {
        autoSubscribe: true,
      });

      roomRef.current = room;
      setParticipantCount(room.numParticipants);
      setStatus("connected");
    } catch (e) {
      setError(e instanceof Error ? e.message : "LiveKit connection failed");
      setStatus("error");
      roomRef.current = null;
    } finally {
      connectingRef.current = false;
    }
  }, [enabled, sessionId, displayName, role]);

  useEffect(() => {
    if (!enabled) {
      void disconnect();
      setStatus("unavailable");
      return;
    }
    void connect();
    return () => {
      void disconnect();
    };
    // Reconnect when session/role changes; display name updates do not force reconnect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, sessionId, role]);

  const connectionLabel =
    status === "connected"
      ? participantCount > 1
        ? "live · in room"
        : "live · connected"
      : status === "connecting"
        ? "connecting realtime"
        : status === "reconnecting"
          ? "reconnecting"
          : status === "error"
            ? "realtime error"
            : status === "unavailable"
              ? "text & voice"
              : status;

  return {
    status,
    error,
    participantCount,
    connectionLabel,
    connect,
    disconnect,
  };
}
