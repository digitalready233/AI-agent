import {
  AI_WORKFLOW_STEPS,
  PLATFORM_FEATURES,
  WORKSPACE_SCREENSHOTS,
  featureStatusLabel,
  type FeatureAvailability,
} from "@/lib/copy/public-messaging";
import styles from "./landing.module.css";

function statusClass(status: FeatureAvailability): string {
  if (status === "available") return styles.statusAvailable;
  if (status === "beta") return styles.statusBeta;
  return styles.statusSoon;
}

export function LandingPlatformProof() {
  return (
    <>
      <section id="workflow" className={styles.sectionAlt}>
        <div className={styles.sectionAltInner}>
          <div className={styles.sectionHeaderCenter}>
            <p className={styles.eyebrow}>See the AI workflow</p>
            <h2 className={`${styles.sectionTitle} font-display`}>
              From first question to human closer
            </h2>
            <p className={styles.sectionLeadCenter}>
              One sales motion — not a support ticket. Every step is tracked in your
              workspace with lead score, stage, and recommended next action.
            </p>
          </div>
          <ol className={styles.workflowSteps}>
            {AI_WORKFLOW_STEPS.map((step, i) => (
              <li key={step.title} className={styles.workflowStep}>
                <span className={styles.workflowIndex}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className={`${styles.workflowTitle} font-display`}>
                    {step.title}
                  </h3>
                  <p className={styles.workflowBody}>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="platform-proof" className={styles.section}>
        <div className={styles.sectionHeaderCenter}>
          <p className={styles.eyebrow}>Platform proof</p>
          <h2 className={`${styles.sectionTitle} font-display`}>
            What is live today
          </h2>
          <p className={styles.sectionLeadCenter}>
            Enterprise-grade AI sales automation — each capability is labeled so
            prospects know what is production-ready versus beta or on the roadmap.
          </p>
        </div>
        <ul className={styles.featureMatrix}>
          {PLATFORM_FEATURES.map((f) => (
            <li key={f.name} className={styles.featureRow}>
              <span className={styles.featureName}>{f.name}</span>
              <span className={`${styles.featureStatus} ${statusClass(f.status)}`}>
                {featureStatusLabel(f.status)}
              </span>
              {f.note ? (
                <span className={styles.featureNote}>{f.note}</span>
              ) : null}
            </li>
          ))}
        </ul>

        <div className={styles.screenshotGrid}>
          {WORKSPACE_SCREENSHOTS.map((s) => (
            <article key={s.title} className={styles.screenshotCard}>
              <div className={styles.screenshotPlaceholder} aria-hidden>
                <span className={styles.screenshotPlaceholderLabel}>
                  {s.title}
                </span>
              </div>
              <h3 className={`${styles.screenshotTitle} font-display`}>
                {s.title}
              </h3>
              <p className={styles.screenshotCaption}>{s.caption}</p>
            </article>
          ))}
        </div>
        <p className={styles.screenshotDisclaimer}>
          Replace placeholders with your own workspace screenshots when ready for
          marketing — the product screens above map to real dashboard routes.
        </p>
      </section>
    </>
  );
}
