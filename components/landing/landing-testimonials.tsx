import { Quote } from "lucide-react";
import styles from "./landing.module.css";

const TESTIMONIALS = [
  {
    quote:
      "Our beta team runs discovery and booking around the clock — handoff to humans feels seamless, not a dead chatbot loop.",
    name: "Early beta — B2B SaaS",
    role: "Head of Growth, Accra",
  },
  {
    quote:
      "Multilingual chat without hiring three SDRs. The agent stays on-script from our FAQ — no invented pricing.",
    name: "Early beta — Agency",
    role: "Commercial Director",
  },
  {
    quote:
      "Live screen-share demos plus voice callbacks changed how we qualify inbound Meta leads on mobile.",
    name: "Early beta — E-commerce",
    role: "Sales Operations",
  },
] as const;

export function LandingTestimonials() {
  return (
    <section id="testimonials" className={styles.section}>
      <div className={styles.sectionHeaderCenter}>
        <p className={styles.eyebrow}>Early beta feedback</p>
        <h2 className={`${styles.sectionTitle} font-display`}>
          Around-the-clock availability that qualifies — not gimmicks
        </h2>
      </div>
      <div className={styles.testimonialGrid}>
        {TESTIMONIALS.map((t) => (
          <blockquote key={t.name} className={styles.testimonialCard}>
            <Quote className={styles.testimonialIcon} aria-hidden size={20} />
            <p>{t.quote}</p>
            <footer>
              <strong>{t.name}</strong>
              <span>{t.role}</span>
            </footer>
          </blockquote>
        ))}
      </div>
    </section>
  );
}
