/**
 * EDITCORE Agent Operating System — tipos centrales (Prompt 3).
 */
import type { AgentRoleId } from "../agents/roles";
import type { PipelineProvider } from "../orchestration/agentPipeline";

export type TaskIntent =
  | "architecture"
  | "implement"
  | "review"
  | "debug"
  | "test"
  | "document"
  | "evolve"
  | "general";

export interface AgentDefinition {
  id: AgentRoleId;
  label: string;
  responsibilities: string[];
  preferredProvider: PipelineProvider;
  preferredModel: string;
  usesTools: boolean;
  instruction: string;
}

export interface OrchestratorRequest {
  task: string;
  intent?: TaskIntent;
  skipPlan?: boolean;
  skipReview?: boolean;
}

export interface OrchestratorPhaseResult {
  agent: string;
  role: AgentRoleId;
  provider: PipelineProvider;
  model: string;
  output: string;
  success: boolean;
}

export interface OrchestratorResult {
  requestId: string;
  startedAt: string;
  completedAt: string;
  intent: TaskIntent;
  phases: OrchestratorPhaseResult[];
  workPlanPath?: string;
  changeReportPath?: string;
  validationPassed?: boolean;
  markdown: string;
}

export interface ModelRouteDecision {
  provider: PipelineProvider;
  model: string;
  reason: string;
}
