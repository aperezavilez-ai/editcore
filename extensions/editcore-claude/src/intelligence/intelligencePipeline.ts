import * as vscode from "vscode";
import { ApiKeyService } from "../apiKeyService";
import { logEvent } from "../platform/observability";
import { writeSystemMapToWorkspace } from "./docGenerator";
import { runGroundedAnalysis } from "./groundedAnalysis";
import { buildHealthReport, formatHealthReportMarkdown } from "./healthMonitor";
import { requestPermission } from "./permissionGate";
import {
  buildSystemSnapshot,
  formatSystemSnapshotMarkdown,
} from "./systemReader";
import { appendTechMemoryEntry } from "./techMemoryStore";
import { buildLocalAnalysis } from "./localAnalysis";

export interface IntelligencePipelineOptions {
  userQuestion?: string;
  saveSystemMap?: boolean;
  runAnalysis?: boolean;
  recordMemory?: boolean;
}

export interface IntelligencePipelineResult {
  markdown: string;
  savedMapPath?: string;
  memoryEntryId?: string;
  analysisIncluded: boolean;
}

export async function runIntelligencePipeline(
  context: vscode.ExtensionContext,
  apiKeyService: ApiKeyService,
  options: IntelligencePipelineOptions = {}
): Promise<IntelligencePipelineResult> {
  const config = vscode.workspace.getConfiguration("editcore");
  const saveSystemMap =
    options.saveSystemMap ??
    config.get<boolean>("intelligence.autoGenerateMap", true);
  const runAnalysis =
    options.runAnalysis ?? config.get<boolean>("intelligence.autoAnalyze", false);
  const recordMemory =
    options.recordMemory ??
    config.get<boolean>("intelligence.techMemory.enabled", true);

  const [snapshot, health] = await Promise.all([
    buildSystemSnapshot(context, apiKeyService),
    buildHealthReport(context, apiKeyService),
  ]);

  const statusEmoji =
    health.status === "healthy" ? "✅" : health.status === "degraded" ? "⚠️" : "❌";

  const sections: string[] = [
    "# Diagnóstico real EditCore (System Intelligence Layer)",
    "",
    `_Generado: ${new Date().toISOString()}_`,
    `_Fuente: lectura directa del IDE (extensión v${snapshot.extensionVersion}, producto v${snapshot.productVersion})_`,
    "",
    "> **Datos reales del producto** — no simulación ni role-play.",
    "",
    `## Estado general: ${statusEmoji} ${health.status}`,
    "",
    formatHealthReportMarkdown(health),
    "",
    "---",
    "",
    formatSystemSnapshotMarkdown(snapshot),
  ];

  let savedMapPath: string | undefined;
  let memoryEntryId: string | undefined;
  let analysisIncluded = false;

  if (saveSystemMap && vscode.workspace.workspaceFolders?.length) {
    const allowed = await requestPermission(
      "write_docs",
      "Guardar EDITCORE_SYSTEM_MAP.md en .editcore/docs/"
    );
    if (allowed) {
      const saved = await writeSystemMapToWorkspace(snapshot, health);
      savedMapPath = saved.workspacePath;
      sections.push("", "---", "", `**Mapa guardado:** \`${saved.relativePath}\``);
    }
  }

  if (runAnalysis) {
    const analysis = await runGroundedAnalysis(
      apiKeyService,
      snapshot,
      health,
      options.userQuestion
    );
    analysisIncluded = analysis.usedApi;
    if (analysis.inputTokens > 0 || analysis.outputTokens > 0) {
      apiKeyService.recordUsage(analysis.inputTokens, analysis.outputTokens);
    }
    sections.push(
      "",
      "---",
      "",
      analysis.usedApi
        ? "## Análisis interpretado (basado en datos reales)"
        : "## Análisis (local, sin API)",
      "",
      analysis.text
    );
  } else {
    sections.push(
      "",
      "---",
      "",
      buildLocalAnalysis(snapshot, health)
    );
  }

  if (recordMemory && vscode.workspace.workspaceFolders?.length) {
    const allowed = await requestPermission(
      "write_docs",
      "Registrar entrada en .editcore/tech-memory/"
    );
    if (allowed) {
      const entry = await appendTechMemoryEntry({
        type: "diagnostic",
        title: `Diagnóstico SIL — ${health.status}`,
        summary: `Estado ${health.status}. Críticos: ${health.diagnosticSummary.critical}, advertencias: ${health.diagnosticSummary.warning}. Producto v${snapshot.productVersion}.`,
        metadata: {
          productVersion: snapshot.productVersion,
          extensionVersion: snapshot.extensionVersion,
          healthStatus: health.status,
          savedMapPath,
          analysisIncluded,
        },
      });
      memoryEntryId = entry.id;
      sections.push("", `**Memoria técnica:** entrada \`${entry.id}\` en \`.editcore/tech-memory/\``);
    }
  }

  await logEvent(context, "info", "intelligence", "pipeline_completed", {
    status: health.status,
    savedMap: Boolean(savedMapPath),
    analysisIncluded,
    memoryEntryId,
  });

  sections.push(
    "",
    "---",
    "",
    "**Comandos:** `editcore.intelligence.health` · `editcore.intelligence.snapshot` · `editcore.intelligence.generateSystemMap`"
  );

  return {
    markdown: sections.join("\n"),
    savedMapPath,
    memoryEntryId,
    analysisIncluded,
  };
}
