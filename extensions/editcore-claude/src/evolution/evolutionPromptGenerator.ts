import * as fs from "fs";
import * as path from "path";
import type { AutonomyTask } from "../autonomy/types";
import type { HealthReport, SystemSnapshot } from "../intelligence/types";

export interface EvolutionPromptInput {
  snapshot: SystemSnapshot;
  health: HealthReport;
  pendingTasks: AutonomyTask[];
  recentChanges?: string;
  completedPhases?: string[];
  limitations?: string[];
}

export function buildEvolutionPromptMarkdown(input: EvolutionPromptInput): string {
  const { snapshot, health, pendingTasks } = input;
  const statusEmoji =
    health.status === "healthy" ? "✅" : health.status === "degraded" ? "⚠️" : "❌";

  const lines = [
    "# SIGUIENTE_PROMPT_EVOLUCION_EDITCORE",
    "",
    `_Generado: ${new Date().toISOString()}_`,
    `_Producto v${snapshot.productVersion} · extensión v${snapshot.extensionVersion}_`,
    "",
    "## Estado actual",
    "",
    `- **Salud del sistema:** ${statusEmoji} ${health.status}`,
    `- **Hallazgos críticos:** ${health.diagnosticSummary.critical}`,
    `- **Advertencias:** ${health.diagnosticSummary.warning}`,
    `- **Workspace:** ${snapshot.workspaceName ?? snapshot.workspacePath ?? "sin carpeta"}`,
    "",
  ];

  if (input.completedPhases?.length) {
    lines.push("## Fases completadas recientemente", "");
    for (const phase of input.completedPhases) {
      lines.push(`- ${phase}`);
    }
    lines.push("");
  }

  if (input.recentChanges) {
    lines.push("## Mejoras recientes", "", input.recentChanges.slice(0, 3000), "");
  }

  lines.push("## Problemas pendientes", "");
  if (pendingTasks.length === 0) {
    lines.push("_Sin tareas pendientes en cola de autonomía._");
  } else {
    for (const task of pendingTasks.slice(0, 8)) {
      lines.push(`- **${task.title}** (\`${task.id}\`): ${task.evidence}`);
    }
  }
  lines.push("");

  if (input.limitations?.length) {
    lines.push("## Limitaciones detectadas", "");
    for (const lim of input.limitations) {
      lines.push(`- ${lim}`);
    }
    lines.push("");
  }

  const topTask = pendingTasks[0];
  const suggestedPrompt = topTask
    ? topTask.cursorPrompt
    : [
        "Continúa la evolución de EditCore:",
        "",
        "1. Ejecuta editcore.autonomy.diagnose para actualizar hallazgos.",
        "2. Implementa la siguiente mejora del roadmap con cambios mínimos y reversibles.",
        "3. Genera REPORTE_CAMBIOS y QA_CHECKLIST tras cada ciclo.",
        "4. Actualiza memoria técnica en .editcore/tech-memory/.",
      ].join("\n");

  lines.push(
    "## Prompt sugerido para el próximo ciclo",
    "",
    "Copia el bloque siguiente en Cursor o en EditCore Agent:",
    "",
    "```markdown",
    suggestedPrompt,
    "```",
    "",
    "---",
    "",
    "**Comandos útiles:**",
    "- `editcore.autonomy.diagnose` — diagnóstico + cola de tareas",
    "- `editcore.evolution.cycle` — ciclo completo de evolución",
    "- `editcore.multiAgent.enabled: true` — pipeline multiagente",
    ""
  );

  return lines.join("\n");
}

export async function writeEvolutionPrompt(
  root: string,
  markdown: string
): Promise<{ editcorePath: string; repoDocsPath?: string }> {
  const docsDir = path.join(root, ".editcore", "docs");
  await fs.promises.mkdir(docsDir, { recursive: true });
  const editcorePath = path.join(docsDir, "SIGUIENTE_PROMPT_EVOLUCION_EDITCORE.md");
  await fs.promises.writeFile(editcorePath, markdown + "\n", "utf8");

  let repoDocsPath: string | undefined;
  const isEditCoreDev = fs.existsSync(path.join(root, "extensions", "editcore-claude", "package.json"));
  if (isEditCoreDev) {
    const repoDocs = path.join(root, "docs");
    await fs.promises.mkdir(repoDocs, { recursive: true });
    repoDocsPath = path.join(repoDocs, "SIGUIENTE_PROMPT_EVOLUCION_EDITCORE.md");
    await fs.promises.writeFile(repoDocsPath, markdown + "\n", "utf8");
  }

  return { editcorePath, repoDocsPath };
}
