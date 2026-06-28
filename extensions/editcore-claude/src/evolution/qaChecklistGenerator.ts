import * as fs from "fs";
import * as path from "path";
import type { DiagnosticFinding } from "../diagnostics/diagnosticTypes";
import type { ValidationReport } from "../platform/postChangeValidator";

export interface QaChecklistInput {
  gitClean?: boolean;
  validation?: ValidationReport | null;
  findings?: DiagnosticFinding[];
  testsRun?: string[];
  securityChecks?: string[];
}

const DEFAULT_CHECKS = [
  { id: "build", label: "Build compila sin errores", command: "npm run compile" },
  { id: "test", label: "Tests unitarios pasan", command: "npm test" },
  { id: "lint", label: "Linter sin errores críticos", command: "npm run lint" },
  { id: "secrets", label: "Sin secretos en diff", manual: true },
  { id: "git", label: "Cambios en rama dedicada o commit claro", manual: true },
  { id: "revert", label: "Plan de reversión documentado", manual: true },
];

export function buildQaChecklistMarkdown(input: QaChecklistInput = {}): string {
  const lines: string[] = [
    "# QA Checklist — EditCore",
    "",
    "_Generado: " + new Date().toISOString() + "_",
    "",
    "## Checks automáticos",
    "",
    "| ID | Check | Estado |",
    "|----|-------|--------|",
  ];

  for (const check of DEFAULT_CHECKS) {
    let status = "⬜ Pendiente";
    if (check.id === "build" || check.id === "test" || check.id === "lint") {
      const ran = input.validation?.results.some((r) =>
        r.command.includes(check.id === "test" ? "test" : check.id)
      );
      if (ran) {
        const result = input.validation?.results.find((r) =>
          check.id === "test" ? r.command.includes("test") : r.command.includes(check.id)
        );
        status = result?.success ? "✅ OK" : "❌ Falló";
      }
    }
    if (check.id === "git" && input.gitClean !== undefined) {
      status = input.gitClean ? "✅ Limpio" : "⚠️ Cambios pendientes";
    }
    lines.push("| " + check.id + " | " + check.label + " | " + status + " |");
  }

  lines.push("", "## Checks manuales", "");
  lines.push("- [ ] Revisión de seguridad (OWASP básico)");
  lines.push("- [ ] Sin regresiones en chat/agente");
  lines.push("- [ ] Documentación actualizada si aplica");
  lines.push("- [ ] REPORTE_CAMBIOS_EDITCORE.md generado");

  if (input.findings && input.findings.length > 0) {
    const issues = input.findings.filter((f) => f.severity !== "ok").slice(0, 10);
    if (issues.length > 0) {
      lines.push("", "## Hallazgos diagnóstico", "");
      for (const f of issues) {
        lines.push("- **" + f.severity + "** " + f.title + ": " + f.message);
      }
    }
  }

  if (input.validation) {
    lines.push("", "## Resultados validación", "");
    const globalStatus = input.validation.allPassed ? "✅ PASS" : "❌ FAIL";
    lines.push("**Estado global:** " + globalStatus, "");
    for (const r of input.validation.results) {
      const ok = r.success ? "OK" : "FAIL";
      lines.push("### " + r.command + " — " + ok + " (" + String(r.durationMs) + "ms)", "");
      lines.push("```", r.output.slice(-1500), "```", "");
    }
  }

  lines.push("", "---", "", "_EditCore evolution QA — revisar antes de merge/release._");
  return lines.join("\n");
}

export async function writeQaChecklist(root: string, markdown: string): Promise<string> {
  const reportsDir = path.join(root, ".editcore", "reports");
  await fs.promises.mkdir(reportsDir, { recursive: true });
  const checklistPath = path.join(reportsDir, "QA_CHECKLIST.md");
  await fs.promises.writeFile(checklistPath, markdown + "\n", "utf8");
  return checklistPath;
}
