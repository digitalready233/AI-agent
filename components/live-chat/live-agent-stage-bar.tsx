import {
  UI_PIPELINE_STAGES,
  uiStageIndex,
  type UiPipelineStage,
} from "@/lib/live-chat/pipeline-stages";
import styles from "./live-agent-stage-bar.module.css";

export function LiveAgentStageBar({ activeStage }: { activeStage: UiPipelineStage }) {
  const activeIndex = uiStageIndex(activeStage);
  const activeMeta = UI_PIPELINE_STAGES[activeIndex] ?? UI_PIPELINE_STAGES[0];
  const progressPct =
    activeIndex <= 0
      ? 8
      : Math.min(100, ((activeIndex + 1) / UI_PIPELINE_STAGES.length) * 100);

  return (
    <div className={styles.wrap}>
      <div className={styles.activeRow}>
        <span className={styles.activeEyebrow}>Current stage</span>
        <span className={styles.activeName}>{activeMeta.label}</span>
        <span className={styles.activeStep}>
          {activeIndex + 1} / {UI_PIPELINE_STAGES.length}
        </span>
      </div>

      <div
        className={styles.progressTrack}
        role="progressbar"
        aria-valuenow={activeIndex + 1}
        aria-valuemin={1}
        aria-valuemax={UI_PIPELINE_STAGES.length}
        aria-label={`Pipeline progress: ${activeMeta.label}`}
      >
        <span className={styles.progressFill} style={{ width: `${progressPct}%` }} />
      </div>

      <nav className={styles.track} aria-label="Sales pipeline stages">
        {UI_PIPELINE_STAGES.map((stage, index) => {
          const isActive = stage.key === activeStage;
          const isComplete = index < activeIndex;
          return (
            <div key={stage.key} className={styles.node}>
              {index > 0 ? (
                <span
                  className={`${styles.connector} ${isComplete || isActive ? styles.connectorDone : ""}`}
                  aria-hidden
                />
              ) : null}
              <span
                className={`${styles.pill} ${isActive ? styles.pillActive : ""} ${isComplete ? styles.pillDone : ""}`}
                aria-current={isActive ? "step" : undefined}
              >
                <span className={styles.pillDot} aria-hidden />
                {stage.label}
              </span>
            </div>
          );
        })}
      </nav>
    </div>
  );
}
