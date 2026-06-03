import LoginForm from "./LoginForm";
import styles from "./login.module.css";

export function AgentLoginView({ nextPath }: { nextPath: string }) {
  return (
    <div className={styles.shell}>
      <aside className={styles.paneBrand} aria-hidden={false}>
        <div>
          <div className={styles.brandRow}>
            <span className={styles.brandMark} />
            <span className={styles.brandName}>DigiSales.ai</span>
          </div>
          <p className={styles.brandHeadline} style={{ marginTop: "2.5rem" }}>
            Precision conversations. Around the clock.
          </p>
          <p className={styles.brandLead}>
            The same calm, premium experience your buyers expect—now scaled across
            every session.
          </p>
        </div>
        <p className={styles.brandFoot}>Enterprise-grade experience</p>
      </aside>
      <div className={styles.paneForm}>
        <LoginForm nextPath={nextPath} />
      </div>
    </div>
  );
}
