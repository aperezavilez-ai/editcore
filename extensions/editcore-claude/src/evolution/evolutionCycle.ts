/**
 * evolutionCycle — orquesta Fases 5-8: QA, reportes, prompts evolutivos y memoria.
 */
import * as vscode from "vscode";
import { ApiKeyService } from "../apiKeyService";
import { runAutonomyCycle } from "../autonomy/autonomyEngine";
import { loadAutonomyQueue } from "../autonomy/taskQueue";
import { saveMemoryRecord } from "../memory/memoryManager";
import { logEvent } from "../platform/observability";
import {
  runPostChangeValidation,
  isPostChangeValidationEnabled,
} from "../platform/postChangeValidator";
import {
  collectGitChanges,
  formatChangeReportMarkdown,
  writeChangeReport,
} from "./changeReportGenerator";
import { ROADMAP_PHASES } from "./planGenerator";
import { buildEvolutionPromptMarkdown, writeEvolutionPrompt } from "./evolutionPromptGenerator";
import { buildQaChecklistMarkdown, writeQaChecklist } from "./qaChecklistGenerator";

export interface EvolutionCycleResult {
  markdown: string;
  changeReportPath?: string;
  qaChecklistPath?: string;
  evolutionPromptPath?: string;
  validationPassed?: boolean;
}

export async function runEvolutionCycle(
  context: vscode.ExtensionContext,
  apiKeyService: ApiKeyService,
  options: { runValidation?: boolean } = {}
): Promise<EvolutionCycleResult> {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) {
    throw new Error("Abre un workspace para ejecutar el ciclo de evolución.");
  }

  const autonomy = await runAutonomyCycle(context, apiKeyService, {
    saveSystemMap: true,
    recordMemory: true,
  });

  const git = await collectGitChanges(root);
  const gitClean = git.staged.length === 0 && git.unstaged.length === 0 && git.untracked.length === 0;

  let validation = null;
  const runValidation =
    options.runValidation ??
  vscode.workspace.getConfiguration("editcore").get<boolean>("evolution.runValidation", true);

  if (runValidation && isPostChangeValidationEnabled()) {
    validation = await runPostChangeValidation();
  }

  const changeMarkdown = formatChangeReportMarkdown(git, {
    agents: ["Architect", "Coder", "Reviewer", "QA", "Prompt Engineer"],
    validationPassed: validation?.allPassed,
  });
  const { editcorePath: changeReportPath } = await writeChangeReport(root, changeMarkdown);

  const qaMarkdown = buildQaChecklistMarkdown({
    gitClean,
    validation,
    findings: autonomy.health.findings,
  });
  const qaChecklistPath = await writeQaChecklist(root, qaMarkdown);

  const queue = await loadAutonomyQueue();
  const pendingTasks = queue?.tasks.filter((t) => t.status === "pending") ?? autonomy.tasks;

  const evolutionMarkdown = buildEvolutionPromptMarkdown({
    snapshot: autonomy.snapshot,
    health: autonomy.health,
    pendingTasks,
    completedPhases: ROADMAP_PHASES.map((p) => "FASE " + p.id + ": " + p.name),
    recentChanges: git.diffStat || "Sin diff git detectado.",
    limitations: [],
  });
  const { editcorePath: evolutionPromptPath } = await writeEvolutionPrompt(root, evolutionMarkdown);

  await saveMemoryRecord(context, {
    type: "version",
    title: `Ciclo evolución — ${autonomy.health.status}`,
    content: `Reporte: ${changeReportPath}. QA: ${qaChecklistPath}. Prompt: ${evolutionPromptPath}.`,
    scope: "tech",
    metadata: {
      validationPassed: validation?.allPassed,
      pendingTasks: pendingTasks.length,
    },
  });

  await logEvent(context, "info", "evolution", "cycle_completed", {
    health: autonomy.health.status,
    changeReportPath,
    qaChecklistPath,
    evolutionPromptPath,
  });

  const sections = [
    "# Ciclo de evolución EditCore completado",
    "",
    autonomy.markdown,
    "",
    "---",
    "",
    "## Artefactos generados (en el repo/workspace)",
    "",
    `- **REPORTE_CAMBIOS:** \`${changeReportPath.replace(/\\/g, "/")}\``,
    `- **QA Checklist:** \`${qaChecklistPath.replace(/\\/g, "/")}\``,
    `- **SIGUIENTE PROMPT:** \`${evolutionPromptPath.replace(/\\/g, "/")}\``,
    "",
    "Abre `SIGUIENTE_PROMPT_EVOLUCION_EDITCORE.md` para el próximo ciclo en Cursor.",
  ];

  return {
    markdown: sections.join("\n"),
    changeReportPath,
    qaChecklistPath,
    evolutionPromptPath,
    validationPassed: validation?.allPassed,
  };
}
