/**
 * PLAN_DE_TRABAJO.md — Fase 5 (Prompt 3).
 */
import * as fs from "fs";
import * as path from "path";
import { analyzeFileImpact, formatImpactReport } from "../agent/impactAnalyzer";

export interface WorkPlanInput {
  objective: string;
  analysis?: string;
  affectedFiles?: string[];
  steps?: string[];
  risks?: string[];
  tests?: string[];
  rollback?: string[];
}

export function buildWorkPlanMarkdown(input: WorkPlanInput): string {
  const lines = [
    "# PLAN_DE_TRABAJO",
    "",
    "_EditCore Agent Operating System — plan antes de ejecutar_",
    "",
    "**Generado:** " + new Date().toISOString(),
    "",
    "## Objetivo",
    "",
    input.objective,
    "",
    "## Análisis",
    "",
    input.analysis ?? "_Pendiente de análisis del Architect Agent._",
    "",
    "## Archivos afectados",
    "",
  ];

  if (input.affectedFiles && input.affectedFiles.length > 0) {
    for (const f of input.affectedFiles) {
      lines.push("- `" + f + "`");
    }
  } else {
    lines.push("_Se determinarán tras analyze_impact._");
  }

  lines.push("", "## Pasos", "");
  const steps = input.steps ?? [
    "1. Architect: diseño y análisis de impacto",
    "2. Developer: implementación con herramientas",
    "3. Code Review + Security: revisión",
    "4. QA: pruebas",
    "5. Documentation + reportes",
  ];
  for (const s of steps) {
    lines.push(typeof s === "string" && /^\d/.test(s) ? s : "- " + s);
  }

  lines.push("", "## Riesgos", "");
  for (const r of input.risks ?? ["Regresiones en módulos dependientes", "Exposición accidental de secretos"]) {
    lines.push("- " + r);
  }

  lines.push("", "## Pruebas necesarias", "");
  for (const t of input.tests ?? ["npm run compile", "npm test", "Revisión manual de diff"]) {
    lines.push("- " + t);
  }

  lines.push("", "## Estrategia de reversión", "");
  for (const r of input.rollback ?? [
    "Crear rama `editcore/work-*` antes de cambios",
    "git stash / git reset según REPORTE_CAMBIOS",
  ]) {
    lines.push("- " + r);
  }

  lines.push(
    "",
    "---",
    "",
    "_Aprobar este plan antes de ejecutar con `editcore.aos.run` (nivel autonomía ≥3)._"
  );

  return lines.join("\n");
}

export async function inferAffectedFilesFromTask(task: string): Promise<string[]> {
  const files: string[] = [];
  const pathMatches = task.match(/[\w./\\-]+\.(ts|tsx|js|json|md|py|go|rs)/g);
  if (pathMatches) {
    files.push(...pathMatches.slice(0, 10));
  }
  if (files.length > 0 && files[0]) {
    try {
      const impact = await analyzeFileImpact(files[0]);
      files.push(...impact.importers.slice(0, 5));
    } catch {
      // opcional
    }
  }
  return [...new Set(files)];
}

export async function writeWorkPlan(root: string, markdown: string): Promise<string> {
  const docsDir = path.join(root, ".editcore", "docs");
  await fs.promises.mkdir(docsDir, { recursive: true });
  const planPath = path.join(docsDir, "PLAN_DE_TRABAJO.md");
  await fs.promises.writeFile(planPath, markdown + "\n", "utf8");

  const isDev = fs.existsSync(path.join(root, "extensions", "editcore-claude", "package.json"));
  if (isDev) {
    const repoDocs = path.join(root, "docs");
    await fs.promises.mkdir(repoDocs, { recursive: true });
    await fs.promises.writeFile(path.join(repoDocs, "PLAN_DE_TRABAJO.md"), markdown + "\n", "utf8");
  }

  return planPath;
}

export async function generateWorkPlan(task: string): Promise<{ markdown: string; path?: string }> {
  const affected = await inferAffectedFilesFromTask(task);
  let impactBlock = "";
  if (affected[0]) {
    try {
      impactBlock = formatImpactReport(await analyzeFileImpact(affected[0]));
    } catch {
      impactBlock = "";
    }
  }

  const markdown = buildWorkPlanMarkdown({
    objective: task,
    analysis: impactBlock || "Tarea detectada por EditCore AI Orchestrator.",
    affectedFiles: affected,
  });

  return { markdown };
}
