import Link from "next/link";
import { CalendlyInline } from "@/components/demo/calendly-inline";
import { booking, brand } from "@/lib/config";
import { calendlyEmbedUrl } from "@/lib/booking/calendly";
import styles from "./demo.module.css";

const BENEFITS = [
  {
    title: "Live platform walkthrough",
    body: "See discovery, qualification, knowledge base, and handoff in your workspace context.",
  },
  {
    title: "Real AI conversations",
    body: "Watch how agents handle objections, scoring, and when to bring in your team.",
  },
  {
    title: "Personalized setup advice",
    body: "We map embed, WhatsApp, voice, and Paystack billing to your go-live timeline.",
  },
  {
    title: "Open Q&A",
    body: "Integrations, security, languages, and pricing — no generic slide deck.",
  },
] as const;

export default function BookDemoPage() {
  const bookingUrl = booking.url.trim();
  const calendlyUrl = calendlyEmbedUrl(bookingUrl);

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.top}>
          <Link href="/">← DigiSales.ai</Link>
          <p className={styles.eyebrow}>Book a demo</p>
          <h1 className={`${styles.title} font-display`}>
            See your AI sales agent in action
          </h1>
          <p className={styles.lead}>
            Book a call with {brand.name} to review live qualification, demo rooms,
            human handoff, and how your team gets notified with the visitor&apos;s
            contact details when the AI escalates.
          </p>
        </header>

        <ul className={styles.benefits}>
          {BENEFITS.map((b) => (
            <li key={b.title}>
              <strong>{b.title}</strong>
              {b.body}
            </li>
          ))}
        </ul>

        <section className={styles.scheduler} aria-label="Schedule a demo">
          {calendlyUrl ? (
            <CalendlyInline url={calendlyUrl} />
          ) : bookingUrl ? (
            <div className={styles.fallback}>
              <p>
                Pick a time on our calendar to meet the {brand.name} team and plan
                your DigiSales rollout.
              </p>
              <a className={styles.btn} href={bookingUrl} target="_blank" rel="noreferrer">
                Open scheduling page
              </a>
            </div>
          ) : (
            <div className={styles.fallback}>
              <p>
                Demo scheduling is not configured yet. Set{" "}
                <code>NEXT_PUBLIC_BOOKING_URL</code> to your Calendly or Cal.com link
                (for example <code>https://calendly.com/your-team/demo</code>).
              </p>
              <Link href="/auth/register" className={styles.btn}>
                Start free trial instead
              </Link>
            </div>
          )}
        </section>

        <Link href="/" className={styles.btnGhost}>
          Back to home
        </Link>
      </div>
    </div>
  );
}
