/**
 * Generador de mejoras — Fase 10 (Prompt 4).
 */
import * as fs from "fs";
import * as path from "path";
import type { QualityGateResult } from "./qualityGate";
import type { AutonomousPlan, ProjectUnderstanding } from "./types";

export function buildImprovementPlan(input: {
  objective: string;
  understanding: ProjectUnderstanding;
  plan: AutonomousPlan;
  quality: QualityGateResult;
  modifiedFiles: string[];
}): string {
  const improvements: string[] = [];
  const techDebt: string[] = [];

  if (!input.quality.validation?.allPassed) {
    improvements.push("Corregir pruebas fallidas antes del siguiente ciclo");
  }
  if (input.understanding.risks.length) {
    techDebt.push(...input.understanding.risks.map((r) => "Riesgo: " + r));
  }
  if (input.modifiedFiles.length > 10) {
    techDebt.push("Diff amplio (" + input.modifiedFiles.length + " archivos) — considerar dividir en PRs");
  }
  if (!input.modifiedFiles.some((f) => f.includes("test"))) {
    improvements.push("Añadir cobertura de tests para la funcionalidad implementada");
  }
  if (input.understanding.framework === "VS Code Extension") {
    improvements.push("Verificar deploy portable tras cambios en extensión");
  }

  improvements.push("Ejecutar editcore.autonomous.run con siguiente objetivo derivado");
  improvements.push("Revisar TASK_COMPLETION_REPORT y cerrar deuda técnica listada");

  const lines = [
    "# NEXT_IMPROVEMENT_PLAN",
    "",
    "_EditCore Autonomous Developer Engine — post-tarea_",
    "",
    "**Generado:** " + new Date().toISOString(),
    "",
    "## Tarea completada",
    "",
    input.objective,
    "",
    "## Qué se puede mejorar",
    "",
    ...improvements.map((i) => "- " + i),
    "",
    "## Deuda técnica detectada",
    "",
    ...(techDebt.length ? techDebt.map((d) => "- " + d) : ["_Ninguna crítica detectada_"]),
    "",
    "## Optimizaciones recomendadas",
    "",
    "- Ejecutar `editcore.aos.evolutionManager` para roadmap global",
    "- Subir nivel de autonomía solo tras validar calidad en nivel actual",
    "- Regenerar PROJECT_UNDERSTANDING si cambió la arquitectura",
    "",
    "## Próximo objetivo sugerido",
    "",
    "Refinar y endurecer: " + input.objective.slice(0, 120) + " (tests, docs, edge cases)",
  ];
  return lines.join("\n");
}

export async function writeImprovementPlan(root: string, markdown: string): Promise<string> {
  const dir = path.join(root, ".editcore", "docs");
  await fs.promises.mkdir(dir, { recursive: true });
  const planPath = path.join(dir, "NEXT_IMPROVEMENT_PLAN.md");
  await fs.promises.writeFile(planPath, markdown + "\n", "utf8");

  const isDev = fs.existsSync(path.join(root, "extensions", "editcore-claude", "package.json"));
  if (isDev) {
    const docsDir = path.join(root, "docs");
    await fs.promises.mkdir(docsDir, { recursive: true });
    await fs.promises.writeFile(path.join(docsDir, "NEXT_IMPROVEMENT_PLAN.md"), markdown + "\n", "utf8");
  }

  return planPath;
}
