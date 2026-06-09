import {
  UI_PIPELINE_STAGES,
  uiStageIndex,
  type UiPipelineStage,
} from "@/lib/live-chat/pipeline-stages";
import styles from "./live-agent-stage-bar.module.css";

export function LiveAgentStageBar({ activeStage }: { activeStage: UiPipelineStage }) {
  const activeIndex = uiStageIndex(activeStage);

  return (
    <nav
      className={styles.track}
      aria-label="Sales pipeline progress"
    >
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
              {stage.label}
            </span>
          </div>
        );
      })}
    </nav>
  );
}
