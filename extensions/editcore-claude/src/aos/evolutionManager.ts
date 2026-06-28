/**
 * EDITCORE Evolution Manager — Fase 10 (Prompt 3).
 * Envuelve evolution + autonomy sin duplicar lógica.
 */
import * as vscode from "vscode";
import { ApiKeyService } from "../apiKeyService";
import { runAutonomyCycle } from "../autonomy/autonomyEngine";
import { runEvolutionCycle } from "../evolution/evolutionCycle";
import { generateImplementationPlan } from "../evolution/phaseExecutor";
import { buildEvolutionPromptMarkdown, writeEvolutionPrompt } from "../evolution/evolutionPromptGenerator";
import { loadAutonomyQueue } from "../autonomy/taskQueue";
import { logEvent } from "../platform/observability";

export interface EvolutionManagerResult {
  recommendations: string[];
  roadmapPath?: string;
  nextPromptPath?: string;
  performanceNotes: string[];
}

export async function runEvolutionManagerCycle(
  context: vscode.ExtensionContext,
  apiKeyService: ApiKeyService
): Promise<EvolutionManagerResult> {
  const autonomy = await runAutonomyCycle(context, apiKeyService, {
    saveSystemMap: true,
    recordMemory: true,
  });

  const queue = await loadAutonomyQueue();
  const pending = queue?.tasks.filter((t) => t.status === "pending") ?? autonomy.tasks;

  const recommendations = pending.slice(0, 5).map((t) => t.title + ": " + t.evidence);

  if (recommendations.length === 0) {
    recommendations.push("Sistema saludable. Considerar optimización de índice RAG o release.");
  }

  const { planPath } = await generateImplementationPlan(context, apiKeyService);

  const evolutionMd = buildEvolutionPromptMarkdown({
    snapshot: autonomy.snapshot,
    health: autonomy.health,
    pendingTasks: pending,
    completedPhases: ["Evolution Manager cycle"],
    recentChanges: recommendations.join("; "),
    limitations: [],
  });

  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  let nextPromptPath: string | undefined;
  if (root) {
    const saved = await writeEvolutionPrompt(root, evolutionMd);
    nextPromptPath = saved.editcorePath;
  }

  await logEvent(context, "info", "aos", "evolution_manager", {
    recommendations: recommendations.length,
    health: autonomy.health.status,
  });

  return {
    recommendations,
    roadmapPath: planPath,
    nextPromptPath,
    performanceNotes: [
      "Hallazgos críticos: " + autonomy.health.diagnosticSummary.critical,
      "Tareas pendientes: " + pending.length,
      "Estado: " + autonomy.health.status,
    ],
  };
}

export async function runFullEvolutionWithManager(
  context: vscode.ExtensionContext,
  apiKeyService: ApiKeyService
): Promise<string> {
  const evo = await runEvolutionCycle(context, apiKeyService);
  const mgr = await runEvolutionManagerCycle(context, apiKeyService);
  return (
    evo.markdown +
    "\n\n---\n\n## Evolution Manager\n\n" +
    "**Recomendaciones:**\n" +
    mgr.recommendations.map((r) => "- " + r).join("\n") +
    "\n\n**Rendimiento:**\n" +
    mgr.performanceNotes.map((n) => "- " + n).join("\n")
  );
}
