"use client";

import { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import { visitorAuthHeaders } from "@/lib/auth/visitor-session-client";
import {
  mergeVisitorChatMessages,
  VISITOR_HANDOFF_POLL_MS,
  type VisitorChatMessage,
  type VisitorChatSyncPayload,
} from "@/lib/platform/visitor-chat";

export type { VisitorChatMessage, VisitorChatSyncPayload };

function applyPayloadToCallbacks(
  payload: VisitorChatSyncPayload,
  opts: {
    onSync: (payload: VisitorChatSyncPayload) => void;
    onMessages?: (messages: VisitorChatMessage[]) => void;
    localMessages?: VisitorChatMessage[];
    onHandoffEnded?: (payload: VisitorChatSyncPayload) => void;
    wasHandoffRef: MutableRefObject<boolean>;
  }
) {
  if (opts.wasHandoffRef.current && !payload.handoffActive) {
    opts.onHandoffEnded?.(payload);
  }
  opts.wasHandoffRef.current = payload.handoffActive;
  opts.onSync(payload);
  if (opts.onMessages) {
    const local = opts.localMessages ?? [];
    opts.onMessages(mergeVisitorChatMessages(local, payload.messages));
  }
}

export function useVisitorHandoffSync(params: {
  sessionId: string;
  agentId: string;
  visitorToken?: string | null;
  enabled: boolean;
  onSync: (payload: VisitorChatSyncPayload) => void;
  onMessages?: (messages: VisitorChatMessage[]) => void;
  onHandoffEnded?: (payload: VisitorChatSyncPayload) => void;
  localMessages?: VisitorChatMessage[];
  /** Prefer SSE; falls back to polling if the stream errors. */
  preferSse?: boolean;
}): { refresh: () => Promise<void> } {
  const {
    sessionId,
    agentId,
    visitorToken,
    enabled,
    onSync,
    onMessages,
    onHandoffEnded,
    localMessages,
    preferSse = true,
  } = params;

  const onSyncRef = useRef(onSync);
  const onMessagesRef = useRef(onMessages);
  const onHandoffEndedRef = useRef(onHandoffEnded);
  const localRef = useRef(localMessages);
  const wasHandoffRef = useRef(false);

  useEffect(() => {
    onSyncRef.current = onSync;
  }, [onSync]);
  useEffect(() => {
    onMessagesRef.current = onMessages;
  }, [onMessages]);
  useEffect(() => {
    onHandoffEndedRef.current = onHandoffEnded;
  }, [onHandoffEnded]);
  useEffect(() => {
    localRef.current = localMessages;
  }, [localMessages]);

  const dispatchPayload = useCallback((payload: VisitorChatSyncPayload) => {
    applyPayloadToCallbacks(payload, {
      onSync: (p) => onSyncRef.current(p),
      onMessages: onMessagesRef.current
        ? (m) => onMessagesRef.current!(m)
        : undefined,
      onHandoffEnded: onHandoffEndedRef.current
        ? (p) => onHandoffEndedRef.current!(p)
        : undefined,
      localMessages: localRef.current,
      wasHandoffRef,
    });
  }, []);

  const refresh = useCallback(async () => {
    if (!sessionId || !agentId) return;

    const qs = new URLSearchParams({ sessionId, agentId });
    if (visitorToken) qs.set("visitorToken", visitorToken);
    const res = await fetch(`/api/platform/chat/sync?${qs.toString()}`, {
      headers: visitorAuthHeaders(visitorToken ?? null),
    });
    if (!res.ok) return;

    const payload = (await res.json()) as VisitorChatSyncPayload;
    dispatchPayload(payload);
  }, [sessionId, agentId, visitorToken, dispatchPayload]);

  useEffect(() => {
    if (!enabled || !sessionId || !agentId) {
      wasHandoffRef.current = false;
      return;
    }

    wasHandoffRef.current = true;

    let pollId: number | null = null;
    let eventSource: EventSource | null = null;
    let fellBackToPoll = false;

    const startPolling = () => {
      if (pollId !== null) return;
      void refresh();
      pollId = window.setInterval(() => void refresh(), VISITOR_HANDOFF_POLL_MS);
    };

    const stopPolling = () => {
      if (pollId !== null) {
        window.clearInterval(pollId);
        pollId = null;
      }
    };

    const startSse = () => {
      const qs = new URLSearchParams({ sessionId, agentId });
      if (visitorToken) qs.set("visitorToken", visitorToken);
      eventSource = new EventSource(
        `/api/platform/chat/stream?${qs.toString()}`
      );

      eventSource.addEventListener("sync", (ev) => {
        try {
          const payload = JSON.parse(
            (ev as MessageEvent<string>).data
          ) as VisitorChatSyncPayload;
          dispatchPayload(payload);
        } catch {
          /* ignore malformed */
        }
      });

      eventSource.addEventListener("error", (ev) => {
        try {
          const data = JSON.parse((ev as MessageEvent<string>).data) as {
            error?: string;
          };
          if (data.error) {
            eventSource?.close();
            eventSource = null;
            startPolling();
            return;
          }
        } catch {
          /* connection error — handled below */
        }
      });

      eventSource.onerror = () => {
        eventSource?.close();
        eventSource = null;
        if (!fellBackToPoll) {
          fellBackToPoll = true;
          startPolling();
        }
      };
    };

    if (preferSse && typeof EventSource !== "undefined") {
      startSse();
    } else {
      startPolling();
    }

    return () => {
      eventSource?.close();
      stopPolling();
      wasHandoffRef.current = false;
    };
  }, [
    enabled,
    sessionId,
    agentId,
    visitorToken,
    preferSse,
    refresh,
    dispatchPayload,
  ]);

  return { refresh };
}
