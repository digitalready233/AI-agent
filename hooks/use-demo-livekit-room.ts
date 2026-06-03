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

export type RemoteVideoTile = {
  identity: string;
  name: string;
  isSpeaking: boolean;
};

type TokenResponse = {
  livekit?: {
    url: string;
    token: string;
    room_name: string;
    identity: string;
    role: string;
  } | null;
  error?: string;
  internal_mode?: boolean;
};

function participantLabel(identity: string, name?: string): string {
  if (name?.trim()) return name.trim();
  if (identity.startsWith("staff-")) return "Team member";
  if (identity.startsWith("prospect-")) return "Prospect";
  return identity;
}

export type DemoAiRoomSyncMessage = {
  type: "ai_sync";
  demo_session_id: string;
  aiState: string;
  ai_audio_mode: string;
  ai_audio_status: string;
  ai_paused: boolean;
  selectedDemoPathId?: string | null;
  currentDemoAssetId?: string | null;
  leadScore?: number | null;
  leadCategory?: string | null;
  bookingRecommended?: boolean;
  handoffRequired?: boolean;
  recommendedNextAction?: string | null;
  demoStage?: string | null;
  presentationControlMode?: string | null;
  screenShareActive?: boolean;
  currentPresenterType?: string | null;
  currentPresenterId?: string | null;
  currentAssetIndex?: number | null;
  pendingPresentationAction?: Record<string, unknown> | null;
  aiPresenterState?: string | null;
  ts: string;
};

export function useDemoLivekitRoom(opts: {
  sessionId: string;
  enabled: boolean;
  displayName: string;
  role?: "prospect" | "staff";
  autoConnect?: boolean;
  onAiRoomSync?: (payload: DemoAiRoomSyncMessage) => void;
  onScreenShareChange?: (active: boolean) => void;
}) {
  const { sessionId, enabled, displayName, role = "prospect", autoConnect = false } = opts;
  const [status, setStatus] = useState<DemoLiveKitStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [participantCount, setParticipantCount] = useState(0);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);
  const [remoteTiles, setRemoteTiles] = useState<RemoteVideoTile[]>([]);
  const [localVideoReady, setLocalVideoReady] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [screenShareSupported, setScreenShareSupported] = useState(true);
  const [remoteScreenShareIdentity, setRemoteScreenShareIdentity] = useState<string | null>(
    null
  );
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const roomRef = useRef<import("livekit-client").Room | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const connectingRef = useRef(false);

  const syncRemoteTiles = useCallback((room: import("livekit-client").Room) => {
    const tiles: RemoteVideoTile[] = [];
    room.remoteParticipants.forEach((p) => {
      tiles.push({
        identity: p.identity,
        name: participantLabel(p.identity, p.name),
        isSpeaking: p.isSpeaking,
      });
    });
    setRemoteTiles(tiles);
    setParticipantCount(room.numParticipants);
  }, []);

  const disconnect = useCallback(async () => {
    const room = roomRef.current;
    roomRef.current = null;
    connectingRef.current = false;
    if (room) {
      try {
        room.localParticipant.trackPublications.forEach((pub) => {
          pub.track?.detach();
        });
        await room.disconnect();
      } catch {
        /* ignore */
      }
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    remoteVideoRefs.current.clear();
    setParticipantCount(0);
    setActiveSpeakerId(null);
    setRemoteTiles([]);
    setLocalVideoReady(false);
    setStatus((s) => (s === "unavailable" ? "unavailable" : "disconnected"));
  }, []);

  const fetchToken = useCallback(async () => {
    const res = await fetch("/api/demo/livekit/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        demo_session_id: sessionId,
        name: displayName.trim() || "Guest",
        role,
        identity: `${role}-${sessionId.slice(0, 8)}-${Date.now()}`,
        ensure_room: true,
      }),
    });
    return (await res.json()) as TokenResponse & { ok?: boolean };
  }, [sessionId, displayName, role]);

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
      const data = await fetchToken();
      if (data.error && !data.livekit?.token) {
        throw new Error(data.error);
      }
      if (!data.livekit?.url || !data.livekit.token) {
        setStatus("unavailable");
        connectingRef.current = false;
        return;
      }

      const { Room, RoomEvent, ConnectionState, Track } = await import("livekit-client");
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      room.on(RoomEvent.ConnectionStateChanged, (state) => {
        if (state === ConnectionState.Connected) setStatus("connected");
        else if (state === ConnectionState.Reconnecting) setStatus("reconnecting");
        else if (state === ConnectionState.Disconnected) setStatus("disconnected");
      });

      room.on(RoomEvent.ParticipantConnected, () => syncRemoteTiles(room));
      room.on(RoomEvent.ParticipantDisconnected, () => syncRemoteTiles(room));

      room.on(RoomEvent.DataReceived, (payload) => {
        try {
          const json = JSON.parse(new TextDecoder().decode(payload)) as DemoAiRoomSyncMessage;
          if (json?.type === "ai_sync") opts.onAiRoomSync?.(json);
        } catch {
          /* ignore non-JSON */
        }
      });
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        setActiveSpeakerId(speakers[0]?.identity ?? null);
        syncRemoteTiles(room);
      });

      const refreshScreenShare = () => {
        let found: string | null = null;
        room.remoteParticipants.forEach((p) => {
          p.trackPublications.forEach((pub) => {
            if (pub.source === Track.Source.ScreenShare && pub.track) {
              found = p.identity;
              if (screenVideoRef.current) pub.track.attach(screenVideoRef.current);
            }
          });
        });
        setRemoteScreenShareIdentity(found);
      };

      room.on(RoomEvent.TrackSubscribed, (track, pub, participant) => {
        if (track.kind === Track.Kind.Video) {
          if (pub.source === Track.Source.ScreenShare) {
            setRemoteScreenShareIdentity(participant.identity);
            if (screenVideoRef.current) track.attach(screenVideoRef.current);
          } else {
            const el = remoteVideoRefs.current.get(participant.identity);
            if (el) track.attach(el);
          }
        }
        if (track.kind === Track.Kind.Audio) {
          const audioEl = document.createElement("audio");
          audioEl.autoplay = true;
          track.attach(audioEl);
        }
        syncRemoteTiles(room);
        refreshScreenShare();
      });

      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach();
      });

      room.on(RoomEvent.LocalTrackPublished, (pub) => {
        if (pub.source === Track.Source.ScreenShare) {
          setScreenSharing(true);
          opts.onScreenShareChange?.(true);
        }
        if (pub.kind === Track.Kind.Video && pub.track && localVideoRef.current) {
          if (pub.source !== Track.Source.ScreenShare) {
            pub.track.attach(localVideoRef.current);
            setLocalVideoReady(true);
          }
        }
      });

      room.on(RoomEvent.LocalTrackUnpublished, (pub) => {
        if (pub.source === Track.Source.ScreenShare) {
          setScreenSharing(false);
          setRemoteScreenShareIdentity(null);
          opts.onScreenShareChange?.(false);
        }
      });

      await room.connect(data.livekit.url, data.livekit.token, { autoSubscribe: true });

      try {
        await room.localParticipant.setMicrophoneEnabled(micEnabled);
        await room.localParticipant.setCameraEnabled(cameraEnabled);
      } catch (permErr) {
        setError(
          permErr instanceof Error
            ? permErr.message
            : "Microphone or camera permission denied"
        );
      }

      const cameraPub = Array.from(room.localParticipant.videoTrackPublications.values())[0];
      if (cameraPub?.track && localVideoRef.current) {
        cameraPub.track.attach(localVideoRef.current);
        setLocalVideoReady(true);
      }

      roomRef.current = room;
      syncRemoteTiles(room);
      setStatus("connected");
    } catch (e) {
      setError(e instanceof Error ? e.message : "LiveKit connection failed");
      setStatus("error");
      roomRef.current = null;
    } finally {
      connectingRef.current = false;
    }
  }, [enabled, sessionId, fetchToken, micEnabled, cameraEnabled, syncRemoteTiles]);

  const toggleMic = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !micEnabled;
    await room.localParticipant.setMicrophoneEnabled(next);
    setMicEnabled(next);
  }, [micEnabled]);

  const toggleScreenShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room || role !== "staff") return;
    try {
      const { Track } = await import("livekit-client");
      if (screenSharing) {
        await room.localParticipant.setScreenShareEnabled(false);
        setScreenSharing(false);
        opts.onScreenShareChange?.(false);
        return;
      }
      if (
        typeof navigator !== "undefined" &&
        !navigator.mediaDevices?.getDisplayMedia
      ) {
        setScreenShareSupported(false);
        throw new Error("Screen sharing is not supported in this browser");
      }
      await room.localParticipant.setScreenShareEnabled(true, {
        audio: false,
      });
      setScreenSharing(true);
      setScreenShareSupported(true);
      opts.onScreenShareChange?.(true);
    } catch (e) {
      setScreenShareSupported(false);
      setError(
        e instanceof Error
          ? e.message
          : "Screen share is not available in this browser"
      );
    }
  }, [screenSharing, role]);

  const toggleCamera = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !cameraEnabled;
    await room.localParticipant.setCameraEnabled(next);
    setCameraEnabled(next);
    if (!next && localVideoRef.current) {
      localVideoRef.current.srcObject = null;
      setLocalVideoReady(false);
    }
  }, [cameraEnabled]);

  const leaveRoom = useCallback(async () => {
    await disconnect();
  }, [disconnect]);

  const setRemoteVideoRef = useCallback((identity: string, el: HTMLVideoElement | null) => {
    if (el) {
      remoteVideoRefs.current.set(identity, el);
      const room = roomRef.current;
      if (!room) return;
      const participant = room.remoteParticipants.get(identity);
      participant?.trackPublications.forEach((pub) => {
        if (pub.track) pub.track.attach(el);
      });
    } else {
      remoteVideoRefs.current.delete(identity);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      void disconnect();
      setStatus("unavailable");
      return;
    }
    if (autoConnect) {
      void connect();
    } else {
      setStatus("idle");
    }
    return () => {
      void disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, sessionId, role, autoConnect]);

  const connectionLabel =
    status === "connected"
      ? participantCount > 1
        ? "LiveKit · in room"
        : "LiveKit · connected"
      : status === "connecting"
        ? "LiveKit · connecting"
        : status === "reconnecting"
          ? "LiveKit · reconnecting"
          : status === "error"
            ? "LiveKit · error"
            : status === "unavailable"
              ? "Text & voice mode"
              : status;

  return {
    status,
    error,
    participantCount,
    connectionLabel,
    micEnabled,
    cameraEnabled,
    screenSharing,
    screenShareSupported,
    remoteScreenShareIdentity,
    screenVideoRef,
    activeSpeakerId,
    remoteTiles,
    localVideoReady,
    localVideoRef,
    setRemoteVideoRef,
    room: roomRef.current,
    connect,
    disconnect: leaveRoom,
    toggleMic,
    toggleCamera,
    toggleScreenShare,
    role,
  };
}
