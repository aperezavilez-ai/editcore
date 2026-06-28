/**
 * Tipos — EDITCORE Knowledge & Memory System (Prompt 5).
 */

export interface ProjectKnowledgeMap {
  generatedAt: string;
  workspacePath: string;
  workspaceName?: string;
  framework?: string;
  languages: string[];
  topLevelDirs: string[];
  dependencies: string[];
  apis: string[];
  database?: string;
  configFiles: string[];
  docFiles: string[];
  gitBranch?: string;
  recentCommits: string[];
  architectureModules: string[];
  indexedFileCount: number;
  risks: string[];
}

export interface KnowledgeIndexMeta {
  version: 1;
  updatedAt: string;
  codeChunks: number;
  memoryRecords: number;
  docChunks: number;
  logEntries: number;
  changeEntries: number;
}

export interface RagHit {
  source: "local_rag" | "keyword" | "memory" | "architecture" | "qdrant" | "change";
  path?: string;
  score: number;
  text: string;
}

export interface RagPipelineResult {
  query: string;
  hits: RagHit[];
  contextBlock: string;
  tokenEstimate: number;
  sources: string[];
}

export interface SemanticFinding {
  kind: "duplication" | "debt" | "pattern" | "improvement";
  severity: "low" | "medium" | "high";
  message: string;
  paths?: string[];
}

export interface InteractionPreference {
  at: string;
  action: "accepted" | "rejected" | "corrected";
  detail: string;
  tags: string[];
}

export interface MemoryAuditEntry {
  at: string;
  action: string;
  scope: string;
  detail: string;
  user?: string;
}
