import type { DiagnosticFinding } from "../diagnostics/diagnosticTypes";
import type { HealthReport, SystemSnapshot } from "../intelligence/types";

export type AutonomyTaskKind =
  | "fix_code"
  | "fix_config"
  | "run_command"
  | "document"
  | "investigate";

export type AutonomyTaskStatus = "pending" | "in_progress" | "done" | "skipped";

export interface AutonomyTask {
  id: string;
  priority: number;
  kind: AutonomyTaskKind;
  status: AutonomyTaskStatus;
  title: string;
  description: string;
  evidence: string;
  findingId?: string;
  relatedFiles?: string[];
  autoExecutable: boolean;
  /** Prompt listo para pegar en Cursor u otro agente externo. */
  cursorPrompt: string;
  /** Prompt para el agente interno de EditCore (con herramientas). */
  agentPrompt: string;
}

export interface AutonomyQueue {
  version: 1;
  generatedAt: string;
  productVersion: string;
  extensionVersion: string;
  healthStatus: HealthReport["status"];
  workspacePath?: string;
  tasks: AutonomyTask[];
}

export interface AutonomyCycleResult {
  generatedAt: string;
  markdown: string;
  tasks: AutonomyTask[];
  snapshot: SystemSnapshot;
  health: HealthReport;
  queuePath?: string;
  cursorPromptPath?: string;
  reportPath?: string;
  savedMapPath?: string;
}

export interface TaskPlannerInput {
  snapshot: SystemSnapshot;
  health: HealthReport;
  findings: DiagnosticFinding[];
}
