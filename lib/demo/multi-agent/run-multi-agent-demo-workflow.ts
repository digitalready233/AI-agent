import type { DemoWorkflowInput } from "../demo-schemas";
import type { RunDemoWorkflowResult } from "../types";
import { runDemoWorkflow } from "../run-demo-workflow";

/**
 * Multi-agent demo coordinator.
 * Production path: `runDemoWorkflow` detects multi-agent sessions and runs specialists
 * before presenter response. This entry point forces multi-agent mode via session metadata
 * and delegates to the same persistence pipeline.
 */
export async function runMultiAgentDemoWorkflow(
  input: DemoWorkflowInput
): Promise<RunDemoWorkflowResult & { multiAgent?: boolean }> {
  const result = await runDemoWorkflow({
    ...input,
    multiAgentMode: true,
  });
  return { ...result, multiAgent: true };
}
