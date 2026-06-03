import Link from "next/link";
import { booking, brand, meetings } from "@/lib/config";
import styles from "./meet.module.css";

export default function MeetPage() {
  const bookingUrl = booking.url.trim();
  const zoomUrl = meetings.zoomSchedulingUrl.trim();
  const browserEmbed = meetings.browserCallEmbedUrl.trim();

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Meetings &amp; live sessions</p>
        <h1 className={`${styles.title} font-display`}>
          Book a call with {brand.name}
        </h1>
        <p className={styles.lead}>
          Start with scheduling, then join via Zoom or an in-browser room when
          configured. Your AI voice agent can answer questions before or after
          the human call via phone or the{" "}
          <Link href="/voice">browser voice</Link> demo.
        </p>
      </header>

      <div className={styles.grid}>
        <section className={styles.card}>
          <h2>Consultation booking</h2>
          <p>
            Primary calendar link from <code>NEXT_PUBLIC_BOOKING_URL</code>.
          </p>
          {bookingUrl ? (
            <a
              className={styles.btn}
              href={bookingUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open scheduler
            </a>
          ) : (
            <p className={styles.muted}>
              Set <code>NEXT_PUBLIC_BOOKING_URL</code> (e.g. Cal.com, Calendly)
              to enable one-click scheduling.
            </p>
          )}
        </section>

        <section className={styles.card}>
          <h2>Zoom</h2>
          <p>
            Use a fixed scheduling page or OAuth-generated host links from your
            Zoom app. Set <code>NEXT_PUBLIC_ZOOM_SCHEDULING_URL</code>.
          </p>
          {zoomUrl ? (
            <a className={styles.btn} href={zoomUrl} target="_blank" rel="noreferrer">
              Zoom scheduling
            </a>
          ) : (
            <p className={styles.muted}>
              Add your public Zoom scheduling or meeting URL when ready.
            </p>
          )}
        </section>

        <section className={styles.card}>
          <h2>In-browser call</h2>
          <p>
            Embed Daily, Jitsi, Whereby, or similar by setting{" "}
            <code>NEXT_PUBLIC_BROWSER_CALL_EMBED_URL</code> to the embed URL.
          </p>
          {browserEmbed ? (
            <div className={styles.embed}>
              <iframe
                title="Browser meeting"
                src={browserEmbed}
                allow="camera; microphone; fullscreen; display-capture"
              />
            </div>
          ) : (
            <p className={styles.muted}>
              No embed configured — add an iframe-capable meeting URL for guests
              who prefer the browser over Zoom.
            </p>
          )}
        </section>
      </div>

      <p className={styles.back}>
        <Link href="/">← Home</Link>
        {" · "}
        <Link href="/voice">Voice agent</Link>
      </p>
    </div>
  );
}
