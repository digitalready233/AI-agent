"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./live-agent-chat.module.css";

type MeetingType = {
  key: string;
  label: string;
  description: string;
  duration_minutes: number;
};

type Slot = { start: string; end: string; label: string };

export function LiveAgentBookingPanel({
  agentId,
  sessionId,
  conversationId,
  demoSessionId,
  defaultName,
  defaultEmail,
  onBooked,
  onDismiss,
}: {
  agentId: string;
  sessionId: string;
  conversationId?: string;
  /** When set, booking is linked to this demo session in CRM */
  demoSessionId?: string;
  defaultName?: string;
  defaultEmail?: string;
  onBooked: (message: string) => void;
  onDismiss: () => void;
}) {
  const [meetingTypes, setMeetingTypes] = useState<MeetingType[]>([]);
  const [meetingTypeKey, setMeetingTypeKey] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [name, setName] = useState(defaultName ?? "");
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingTypes(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/platform/calendar/meeting-types?agentId=${encodeURIComponent(agentId)}`
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not load meeting types");
        if (cancelled) return;
        const types = (data.meetingTypes ?? []) as MeetingType[];
        setMeetingTypes(types);
        if (types[0]) setMeetingTypeKey(types[0].key);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load booking options");
        }
      } finally {
        if (!cancelled) setLoadingTypes(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [agentId]);

  const loadSlots = useCallback(async () => {
    if (!meetingTypeKey || !date) return;
    setLoadingSlots(true);
    setError(null);
    setSelectedSlot(null);
    try {
      const res = await fetch(
        `/api/bookings/availability?agentId=${encodeURIComponent(agentId)}&date=${encodeURIComponent(date)}&meetingType=${encodeURIComponent(meetingTypeKey)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load times");
      setSlots((data.slots ?? []) as Slot[]);
      if ((data.slots ?? []).length === 0) {
        setError("No open times on this day. Try another date.");
      }
    } catch (err) {
      setSlots([]);
      setError(err instanceof Error ? err.message : "Failed to load times");
    } finally {
      setLoadingSlots(false);
    }
  }, [agentId, date, meetingTypeKey]);

  useEffect(() => {
    if (meetingTypeKey) void loadSlots();
  }, [meetingTypeKey, date, loadSlots]);

  async function confirmBooking() {
    if (!selectedSlot || !meetingTypeKey) return;
    if (!email.trim()) {
      setError("Please enter your email to confirm the booking.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          agentId,
          conversationId,
          meetingType: meetingTypeKey,
          startIso: selectedSlot.start,
          endIso: selectedSlot.end,
          customerEmail: email.trim(),
          customerName: name.trim() || undefined,
          ...(demoSessionId ? { demoSessionId } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Booking could not be completed."
        );
      }
      const msg =
        typeof data.message === "string"
          ? data.message
          : "Your meeting is confirmed. We'll send details to your email.";
      setSuccess(msg);
      onBooked(msg);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Booking failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className={styles.bookingPanel}>
        <p className={styles.bookingSuccess}>{success}</p>
        <button type="button" className={styles.bookingDismiss} onClick={onDismiss}>
          Close
        </button>
      </div>
    );
  }

  return (
    <div className={styles.bookingPanel}>
      <div className={styles.bookingHeader}>
        <strong>Schedule a meeting</strong>
        <button
          type="button"
          className={styles.bookingDismiss}
          onClick={onDismiss}
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>

      {loadingTypes ? (
        <p className={styles.bookingMuted}>Loading options…</p>
      ) : (
        <>
          <label className={styles.bookingLabel}>
            Meeting type
            <select
              className={styles.bookingSelect}
              value={meetingTypeKey}
              onChange={(e) => setMeetingTypeKey(e.target.value)}
              disabled={submitting}
            >
              {meetingTypes.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label} ({m.duration_minutes} min)
                </option>
              ))}
            </select>
          </label>

          <label className={styles.bookingLabel}>
            Date
            <input
              type="date"
              className={styles.bookingInput}
              value={date}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDate(e.target.value)}
              disabled={submitting}
            />
          </label>

          {loadingSlots ? (
            <p className={styles.bookingMuted}>Loading available times…</p>
          ) : (
            <div className={styles.slotGrid}>
              {slots.map((slot) => (
                <button
                  key={slot.start}
                  type="button"
                  className={
                    selectedSlot?.start === slot.start
                      ? styles.slotBtnActive
                      : styles.slotBtn
                  }
                  onClick={() => setSelectedSlot(slot)}
                  disabled={submitting}
                >
                  {slot.label}
                </button>
              ))}
            </div>
          )}

          <label className={styles.bookingLabel}>
            Your name
            <input
              type="text"
              className={styles.bookingInput}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Optional"
              disabled={submitting}
            />
          </label>

          <label className={styles.bookingLabel}>
            Email
            <input
              type="email"
              className={styles.bookingInput}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              disabled={submitting}
            />
          </label>

          {error && <p className={styles.bookingError}>{error}</p>}

          <button
            type="button"
            className={styles.bookingConfirm}
            disabled={!selectedSlot || submitting}
            onClick={() => void confirmBooking()}
          >
            {submitting ? "Confirming…" : "Confirm booking"}
          </button>
        </>
      )}
    </div>
  );
}
