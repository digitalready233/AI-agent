import type { ReadybotMicroStep } from "@/lib/platform/workflow/readybot-micro-steps";
import type { UiPipelineStage } from "@/lib/live-chat/pipeline-stages";
import {
  discoveryMicroStepFlow,
  readybotMicroStepUi,
  stackMicroStepFlow,
} from "@/lib/live-chat/readybot-micro-step-ui";
import styles from "./live-agent-micro-step-track.module.css";

function stepStatus(
  stepId: ReadybotMicroStep,
  current: ReadybotMicroStep | null | undefined,
  seen: Set<ReadybotMicroStep>
): "done" | "active" | "pending" {
  if (current === stepId) return "active";
  if (seen.has(stepId) && current !== stepId) return "done";
  if (!current && !seen.has(stepId)) return "pending";
  if (seen.has(stepId)) return "done";
  return "pending";
}

export function LiveAgentMicroStepTrack({
  pipelineStage,
  currentMicroStep,
  seenMicroSteps,
}: {
  pipelineStage: UiPipelineStage;
  currentMicroStep?: ReadybotMicroStep | null;
  seenMicroSteps: Set<ReadybotMicroStep>;
}) {
  if (pipelineStage !== "discovery" && pipelineStage !== "stack") {
    return null;
  }

  const isDiscovery = pipelineStage === "discovery";
  const flow = isDiscovery ? discoveryMicroStepFlow() : stackMicroStepFlow();
  const activeMeta = currentMicroStep ? readybotMicroStepUi(currentMicroStep) : null;

  const defaultDiscoveryActive =
    isDiscovery && !currentMicroStep && seenMicroSteps.size === 0
      ? "goal_clarify"
      : null;

  const effectiveCurrent = currentMicroStep ?? defaultDiscoveryActive;

  return (
    <div className={styles.track} aria-label={isDiscovery ? "Discovery micro-steps" : "Stack exchanges"}>
      <div className={styles.header}>
        <p className={styles.title}>
          {isDiscovery ? "Discovery micro-steps" : "Stack qualification"}
        </p>
        {activeMeta ? (
          <p className={styles.subtitle}>{activeMeta.badge}</p>
        ) : isDiscovery ? (
          <p className={styles.subtitle}>Sequential clarification</p>
        ) : (
          <p className={styles.subtitle}>One question per exchange</p>
        )}
      </div>

      <div className={styles.steps} role="list">
        {flow.map((item, index) => {
          const status = stepStatus(item.id, effectiveCurrent, seenMicroSteps);
          const isActive = status === "active";
          const isDone = status === "done";
          const stepClass = [
            styles.step,
            isActive && !isDiscovery ? styles.stepStackActive : "",
            isActive && isDiscovery ? styles.stepActive : "",
            isDone ? styles.stepDone : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <span key={item.id} className={stepClass} role="listitem">
              <span className={styles.stepNum} aria-hidden>
                {isDone ? "✓" : index + 1}
              </span>
              {item.shortLabel}
            </span>
          );
        })}
      </div>

      {isDiscovery ? (
        <p className={styles.hint}>
          {effectiveCurrent === "goal_clarify" || (!effectiveCurrent && seenMicroSteps.size === 0) ? (
            <>
              Up next: <em>Are you focusing more on followers, engagement, or conversions?</em>
            </>
          ) : effectiveCurrent === "milestone" ? (
            <>
              Up next: <em>What&apos;s your biggest milestone in the next 6 months?</em>
            </>
          ) : (
            <>Discovery exchanges complete — moving toward Stack when ready.</>
          )}
        </p>
      ) : activeMeta ? (
        <p className={styles.hint}>
          Stack focus: <em>{activeMeta.topic}</em> — reply in text or voice; one question at a time.
        </p>
      ) : (
        <p className={styles.hint}>
          Stack stage — the agent will ask about your service mix one topic at a time.
        </p>
      )}
    </div>
  );
}
