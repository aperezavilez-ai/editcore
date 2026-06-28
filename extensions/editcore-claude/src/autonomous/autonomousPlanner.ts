/**
 * Planificador inteligente — Fase 3 (Prompt 4).
 */
import * as fs from "fs";
import * as path from "path";
import type { AutonomousPlan, ProjectUnderstanding } from "./types";

export function buildAutonomousPlan(
  objective: string,
  understanding: ProjectUnderstanding,
  extraAnalysis?: string
): AutonomousPlan {
  const affectedFiles: string[] = [];
  const lower = objective.toLowerCase();

  if (lower.includes("auth") || lower.includes("autentic")) {
    affectedFiles.push("src/auth/", "middleware", "routes", ".env");
  }
  if (lower.includes("api")) {
    affectedFiles.push("src/api/", "routes/");
  }
  if (lower.includes("test") || lower.includes("prueba")) {
    affectedFiles.push("test/", "**/*.test.ts");
  }
  if (understanding.framework === "VS Code Extension") {
    affectedFiles.push("extensions/editcore-claude/src/", "package.json");
  }
  if (affectedFiles.length === 0) {
    affectedFiles.push("src/", "package.json", "README.md");
  }

  const steps = [
    "1. Revisar PROJECT_UNDERSTANDING.md y arquitectura existente",
    "2. Architect Agent: diseño técnico y análisis de impacto",
    "3. Developer Agent: implementación con cambios mínimos",
    "4. Code Review + Security: validar calidad y secretos",
    "5. QA Agent: ejecutar pruebas (npm test / compile)",
    "6. Self Debug Loop: corregir fallos detectados",
    "7. Documentation Agent: actualizar docs afectados",
    "8. Git Manager: commit descriptivo en rama de trabajo",
  ];

  const requiredChanges = [
    "Implementar funcionalidad solicitada respetando convenciones del proyecto",
    "Añadir o actualizar pruebas si aplica",
    "Actualizar documentación de la feature",
  ];

  const tests = ["npm run compile", "npm test"];
  if (understanding.framework === "VS Code Extension") {
    tests.push("node --test test/*.test.js");
  }

  const dependencies: string[] = [];
  if (lower.includes("google") && lower.includes("auth")) {
    dependencies.push("passport-google-oauth20 o equivalente OAuth2");
  }

  return {
    objective,
    analysis:
      extraAnalysis ??
      understanding.summary +
        "\n\nFramework: " +
        (understanding.framework ?? "N/A") +
        "\nRiesgos: " +
        understanding.risks.join("; "),
    steps,
    affectedFiles: [...new Set(affectedFiles)],
    requiredChanges,
    tests,
    expectedResult:
      "Objetivo cumplido con tests pasando, sin regresiones, documentado y con commit en rama segura.",
    dependencies,
  };
}

export function formatAutonomousPlanMarkdown(plan: AutonomousPlan): string {
  const lines = [
    "# PLAN AUTÓNOMO",
    "",
    "_EditCore Autonomous Planner_",
    "",
    "**Generado:** " + new Date().toISOString(),
    "",
    "## Objetivo",
    "",
    plan.objective,
    "",
    "## Análisis",
    "",
    plan.analysis,
    "",
    "## Plan",
    "",
    ...plan.steps.map((s) => (s.match(/^\d/) ? s : "- " + s)),
    "",
    "## Archivos afectados",
    "",
    ...plan.affectedFiles.map((f) => "- `" + f + "`"),
    "",
    "## Cambios necesarios",
    "",
    ...plan.requiredChanges.map((c) => "- " + c),
    "",
    "## Dependencias técnicas",
    "",
    ...(plan.dependencies.length
      ? plan.dependencies.map((d) => "- " + d)
      : ["_Ninguna adicional detectada_"]),
    "",
    "## Pruebas",
    "",
    ...plan.tests.map((t) => "- `" + t + "`"),
    "",
    "## Resultado esperado",
    "",
    plan.expectedResult,
  ];
  return lines.join("\n");
}

export async function writeAutonomousPlan(root: string, markdown: string): Promise<string> {
  const dir = path.join(root, ".editcore", "autonomous");
  await fs.promises.mkdir(dir, { recursive: true });
  const planPath = path.join(dir, "AUTONOMOUS_PLAN.md");
  await fs.promises.writeFile(planPath, markdown + "\n", "utf8");

  const isDev = fs.existsSync(path.join(root, "extensions", "editcore-claude", "package.json"));
  if (isDev) {
    const docsDir = path.join(root, "docs");
    await fs.promises.mkdir(docsDir, { recursive: true });
    await fs.promises.writeFile(path.join(docsDir, "AUTONOMOUS_PLAN.md"), markdown + "\n", "utf8");
  }

  return planPath;
}
