/**
 * Tipos — EDITCORE Autonomous Developer Engine (Prompt 4).
 */
import type { ValidationReport } from "../platform/postChangeValidator";

export type WorkMode = "copilot" | "autonomous";

export type TaskPhase =
  | "analyze"
  | "plan"
  | "git_backup"
  | "implement"
  | "self_debug"
  | "quality_gate"
  | "document"
  | "improve";

export interface AutonomousTaskRequest {
  objective: string;
  skipGit?: boolean;
  skipImplementation?: boolean;
  maxDebugCycles?: number;
}

export interface PhaseResult {
  phase: TaskPhase;
  success: boolean;
  output: string;
  artifactPath?: string;
}

export interface TaskEngineResult {
  taskId: string;
  startedAt: string;
  completedAt: string;
  objective: string;
  workMode: WorkMode;
  phases: PhaseResult[];
  projectUnderstandingPath?: string;
  planPath?: string;
  completionReportPath?: string;
  improvementPlanPath?: string;
  validation?: ValidationReport;
  gitBranch?: string;
  gitCommit?: string;
  markdown: string;
  success: boolean;
}

export interface ProjectUnderstanding {
  summary: string;
  framework?: string;
  dependencies: string[];
  folderStructure: string[];
  envFiles: string[];
  apis: string[];
  database?: string;
  components: string[];
  risks: string[];
  recommendations: string[];
}

export interface AutonomousPlan {
  objective: string;
  analysis: string;
  steps: string[];
  affectedFiles: string[];
  requiredChanges: string[];
  tests: string[];
  expectedResult: string;
  dependencies: string[];
}

export interface ExecutionLogEntry {
  at: string;
  taskId: string;
  phase: string;
  action: string;
  detail: string;
  success: boolean;
}
