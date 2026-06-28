import type { DiagnosticFinding, DiagnosticSummary } from "../diagnostics/diagnosticTypes";
import type { ObservabilityEntry } from "../platform/observability";

export type IntelligencePermission = "read" | "write_docs" | "write_config" | "write_code";

export interface SystemModuleInfo {
  id: string;
  name: string;
  path: string;
  role: string;
}

export interface IntegrationStatus {
  id: string;
  label: string;
  configured: boolean;
  reachable?: boolean;
  detail?: string;
}

export interface SystemSnapshot {
  generatedAt: string;
  productVersion: string;
  extensionVersion: string;
  vscodeVersion: string;
  workspaceName?: string;
  workspacePath?: string;
  modules: SystemModuleInfo[];
  integrations: IntegrationStatus[];
  settings: Record<string, unknown>;
  apiKeys: {
    hasAnthropic: boolean;
    hasOpenAi: boolean;
    hasOpenRouter: boolean;
    anthropicHint: string;
    openAiHint: string;
  };
  commands: string[];
  flows: string[];
}

export interface PerformanceStatsSummary {
  available: boolean;
  entryCount: number;
  lastEntry?: {
    timestamp: string;
    model: string;
    latency_ms: number;
    operation: string;
    tokens_estimated: number;
  };
  averageLatencyMs?: number;
}

export interface McpHealthSummary {
  configuredServers: number;
  connectedServers: number;
  toolCount: number;
  servers: Array<{ name: string; connected: boolean }>;
}

export interface HealthReport {
  generatedAt: string;
  status: "healthy" | "degraded" | "critical";
  diagnosticSummary: DiagnosticSummary;
  findings: DiagnosticFinding[];
  performance: PerformanceStatsSummary;
  mcp: McpHealthSummary;
  recentEvents: ObservabilityEntry[];
  services: Array<{
    id: string;
    label: string;
    status: "ok" | "warning" | "error" | "unknown";
    message: string;
  }>;
}
