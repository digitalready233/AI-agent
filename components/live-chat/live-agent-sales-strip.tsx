import styles from "./live-agent-sales-strip.module.css";

export function LiveAgentSalesStrip({
  stage,
  intent,
  leadCategory,
  nextAction,
  handoffActive,
  staffJoined,
  bookingReady,
}: {
  stage?: string;
  intent?: string;
  leadCategory?: string;
  nextAction?: string;
  handoffActive?: boolean;
  staffJoined?: boolean;
  bookingReady?: boolean;
}) {
  const show =
    stage ||
    intent ||
    leadCategory ||
    nextAction ||
    handoffActive ||
    bookingReady;
  if (!show) return null;

  return (
    <div className={styles.strip} role="status" aria-live="polite">
      <span className={styles.label}>AI sales session</span>
      {stage && <Chip label="Stage" value={stage.replace(/_/g, " ")} />}
      {intent && <Chip label="Intent" value={intent.replace(/_/g, " ")} />}
      {leadCategory && <Chip label="Lead" value={leadCategory} highlight />}
      {bookingReady && !handoffActive && (
        <Chip label="Booking" value="Ready" highlight />
      )}
      {handoffActive && (
        <Chip
          label="Human closer"
          value={staffJoined ? "Joined" : "Notified"}
          highlight
        />
      )}
      {nextAction && (
        <p className={styles.next}>
          <span className={styles.nextLabel}>Next:</span> {nextAction}
        </p>
      )}
    </div>
  );
}

function Chip({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <span className={highlight ? `${styles.chip} ${styles.chipHighlight}` : styles.chip}>
      <span className={styles.chipLabel}>{label}</span>
      <span className={styles.chipValue}>{value}</span>
    </span>
  );
}
