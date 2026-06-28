/**
 * Control de calidad automático — Fase 9 (Prompt 4).
 */
import * as fs from "fs";
import * as path from "path";
import { ApiKeyService } from "../apiKeyService";
import { runAgentTask, AgentEvent } from "../agent/agentLoop";
import { collectGitChanges } from "../evolution/changeReportGenerator";
import {
  runPostChangeValidation,
  formatValidationMarkdown,
  type ValidationReport,
} from "../platform/postChangeValidator";
import type { AutonomousPlan } from "./types";

export interface QualityGateResult {
  passed: boolean;
  codeReview: string;
  securityReview: string;
  performanceReview: string;
  validation?: ValidationReport;
  reportPath?: string;
}

function buildPerformanceReview(modifiedFiles: string[], diffStat: string): string {
  const lines: string[] = [];
  const fileCount = modifiedFiles.length;
  if (fileCount > 15) {
    lines.push("- Diff amplio (" + fileCount + " archivos): considerar dividir en PRs más pequeños.");
  } else {
    lines.push("- Tamaño del diff: aceptable (" + fileCount + " archivos).");
  }
  if (/package\.json|package-lock/i.test(modifiedFiles.join(" "))) {
    lines.push("- Dependencias modificadas: verificar impacto en bundle y tiempo de build.");
  }
  if (/\.test\.|spec\./i.test(modifiedFiles.join(" "))) {
    lines.push("- Tests actualizados: positivo para regresiones.");
  } else if (fileCount > 0) {
    lines.push("- Sin archivos de test en el diff: valorar añadir cobertura.");
  }
  if (diffStat.length > 2000) {
    lines.push("- Diff extenso: revisar hot paths y posibles cuellos de botella.");
  }
  if (lines.length === 0) {
    lines.push("- Sin alertas de rendimiento detectadas.");
  }
  return lines.join("\n");
}

async function runQuickReview(
  apiKeyService: ApiKeyService,
  role: "reviewer" | "security",
  diffSummary: string,
  objective: string
): Promise<string> {
  const apiKey = await apiKeyService.getApiKey();
  if (!apiKey?.trim()) {
    return "_Sin API key para revisión " + role + "._";
  }

  const prompt =
    role === "reviewer"
      ? "Revisa brevemente estos cambios por calidad y errores:\n\n" +
        diffSummary +
        "\n\nObjetivo: " +
        objective
      : "Audita seguridad (secretos, OWASP básico) de estos cambios:\n\n" +
        diffSummary +
        "\n\nObjetivo: " +
        objective;

  let output = "";
  await runAgentTask(
    apiKey,
    prompt,
    (ev: AgentEvent) => {
      if (ev.type === "assistant_text") {
        output += ev.text;
      }
    },
    undefined,
    undefined,
    undefined,
    role,
    apiKeyService
  );
  return output.slice(0, 3000);
}

export function formatTaskCompletionReport(input: {
  objective: string;
  plan: AutonomousPlan;
  modifiedFiles: string[];
  validation?: ValidationReport;
  codeReview: string;
  securityReview: string;
  performanceReview: string;
  gitBranch?: string;
  gitCommit?: string;
  success: boolean;
}): string {
  const lines = [
    "# TASK_COMPLETION_REPORT",
    "",
    "_EditCore Autonomous Developer Engine_",
    "",
    "**Generado:** " + new Date().toISOString(),
    "**Resultado:** " + (input.success ? "COMPLETADO" : "INCOMPLETO"),
    "",
    "## Objetivo",
    "",
    input.objective,
    "",
    "## Cambios realizados",
    "",
    ...input.plan.requiredChanges.map((c) => "- " + c),
    "",
    "## Archivos modificados",
    "",
    ...(input.modifiedFiles.length
      ? input.modifiedFiles.map((f) => "- `" + f + "`")
      : ["_Sin cambios en git detectados_"]),
    "",
    "## Pruebas realizadas",
    "",
    ...(input.validation
      ? input.validation.results.map(
          (r) => "- `" + r.command + "` — " + (r.success ? "OK" : "FAIL") + " (" + r.durationMs + "ms)"
        )
      : input.plan.tests.map((t) => "- `" + t + "` (pendiente)")),
    "",
    "## Revisión de código",
    "",
    input.codeReview.slice(0, 2000),
    "",
    "## Revisión de seguridad",
    "",
    input.securityReview.slice(0, 2000),
    "",
    "## Revisión de rendimiento",
    "",
    input.performanceReview,
    "",
    "## Git",
    "",
    "- Rama: `" + (input.gitBranch ?? "N/A") + "`",
    "- Commit: " + (input.gitCommit ? "sí" : "no"),
    "",
    "## Resultado",
    "",
    input.success
      ? "Tarea completada según criterios de calidad."
      : "Tarea requiere intervención manual o más ciclos de debug.",
  ];
  return lines.join("\n");
}

export async function runQualityGate(
  root: string,
  apiKeyService: ApiKeyService,
  objective: string,
  plan: AutonomousPlan,
  gitBranch?: string,
  gitCommit?: string
): Promise<QualityGateResult> {
  const git = await collectGitChanges(root);
  const modifiedFiles = [...git.staged, ...git.unstaged, ...git.untracked];
  const diffSummary = git.diffStat || "Sin diff";

  const validation = await runPostChangeValidation();
  const codeReview = await runQuickReview(apiKeyService, "reviewer", diffSummary, objective);
  const securityReview = await runQuickReview(apiKeyService, "security", diffSummary, objective);
  const performanceReview = buildPerformanceReview(modifiedFiles, git.diffStat);

  const validationOk = validation?.allPassed ?? true;
  const securityOk = !/crítico|critical|bloquea|secret exposed/i.test(securityReview);
  const passed = validationOk && securityOk;

  const markdown = formatTaskCompletionReport({
    objective,
    plan,
    modifiedFiles,
    validation,
    codeReview,
    securityReview,
    performanceReview,
    gitBranch,
    gitCommit,
    success: passed,
  });

  const dir = path.join(root, ".editcore", "reports");
  await fs.promises.mkdir(dir, { recursive: true });
  const reportPath = path.join(dir, "TASK_COMPLETION_REPORT.md");
  await fs.promises.writeFile(reportPath, markdown + "\n", "utf8");

  const isDev = fs.existsSync(path.join(root, "extensions", "editcore-claude", "package.json"));
  if (isDev) {
    const docsDir = path.join(root, "docs");
    await fs.promises.mkdir(docsDir, { recursive: true });
    await fs.promises.writeFile(path.join(docsDir, "TASK_COMPLETION_REPORT.md"), markdown + "\n", "utf8");
  }

  if (validation) {
    const validationMd = formatValidationMarkdown(validation);
    await fs.promises.writeFile(
      path.join(dir, "validation-latest.md"),
      validationMd + "\n",
      "utf8"
    );
  }

  return { passed, codeReview, securityReview, performanceReview, validation, reportPath };
}
