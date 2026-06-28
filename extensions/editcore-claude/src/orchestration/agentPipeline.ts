/**
 * agentPipeline — reexporta pipeline AOS (Prompt 3 integrado).
 */
import type { AgentRoleId } from "../agents/roles";
import { AGENT_OS_REGISTRY, getAgentsForIntent } from "../aos/agentRegistry";

export type PipelineProvider = "anthropic" | "openai";

export interface PipelineAgentStep {
  role: AgentRoleId;
  label: string;
  instruction: string;
  preferredProvider: PipelineProvider;
  preferredModel: string;
  usesTools: boolean;
}

export const EDITCORE_AGENT_PIPELINE: PipelineAgentStep[] = AGENT_OS_REGISTRY.map((a) => ({
  role: a.id,
  label: a.label,
  instruction: a.instruction,
  preferredProvider: a.preferredProvider,
  preferredModel: a.preferredModel,
  usesTools: a.usesTools,
}));

export function getPipelineForTask(taskHint: string): PipelineAgentStep[] {
  return getAgentsForIntent(taskHint).map((a) => ({
    role: a.id,
    label: a.label,
    instruction: a.instruction,
    preferredProvider: a.preferredProvider,
    preferredModel: a.preferredModel,
    usesTools: a.usesTools,
  }));
}

export function formatPipelineStepContext(step: PipelineAgentStep, sharedContext: string): string {
  return [
    sharedContext,
    "",
    "## Rol actual: " + step.label,
    "Modelo preferido: " + step.preferredProvider + "/" + step.preferredModel,
    step.instruction,
  ].join("\n");
}

export { AGENT_OS_REGISTRY };
