/**
 * Genera SIGUIENTE_PROMPT tras completar Prompt 4.
 */
import * as fs from "fs";
import * as path from "path";

export function buildPrompt5Markdown(): string {
  const lines = [
    "# SIGUIENTE_PROMPT — EDITCORE (Prompt 5 de 21)",
    "",
    "_Generado tras completar Prompt 4 — Autonomous Developer Engine v1.2.0_",
    "",
    "**Fecha:** " + new Date().toISOString(),
    "",
    "## Estado Prompt 4 — COMPLETADO",
    "",
    "| Fase | Entregable | Estado |",
    "|------|-----------|--------|",
    "| 1 | EDITCORE TASK ENGINE | ✅ |",
    "| 2 | PROJECT_UNDERSTANDING.md | ✅ |",
    "| 3 | AUTONOMOUS PLANNER | ✅ |",
    "| 4 | AUTONOMOUS CODER AGENT | ✅ |",
    "| 5 | Sistema de ejecución + logs | ✅ |",
    "| 6 | SELF DEBUG LOOP | ✅ |",
    "| 7 | EDITCORE GIT MANAGER | ✅ |",
    "| 8 | Modo Copiloto / Autónomo | ✅ |",
    "| 9 | Quality Gate + TASK_COMPLETION_REPORT | ✅ |",
    "| 10 | NEXT_IMPROVEMENT_PLAN | ✅ |",
    "| 11 | Workbench (historial, diff, aceptar/rechazar) | ✅ |",
    "| 12 | Seguridad autónoma | ✅ |",
    "",
    "## Comandos disponibles",
    "",
    "- `editcore.autonomous.run`",
    "- `editcore.autonomous.analyzeProject`",
    "- `editcore.autonomous.generatePlan`",
    "- `editcore.autonomous.openWorkbench`",
    "- `editcore.autonomous.setMode`",
    "- `editcore.autonomous.showDiff`",
    "- `editcore.autonomous.generateDocs`",
    "- `editcore.autonomous.openNextPrompt`",
    "",
    "## Instrucción para el asistente",
    "",
    "Pega el **Prompt 5 de 21** y exige cierre al 100%:",
    "",
    "1. Implementar código real en el repo (no simulación).",
    "2. Integrar con AOS, autonomía y evolución existentes.",
    "3. Comandos + settings + tests + compile + deploy portable.",
    "4. Documentación en docs/ y .editcore/docs/.",
    "5. Generar SIGUIENTE_PROMPT_006 al finalizar.",
    "",
    "## Verificación rápida",
    "",
    "```powershell",
    "cd extensions/editcore-claude",
    "npm run compile",
    "node --test test/*.test.js",
    "```",
    "",
    "Luego en EditCore: `editcore.autonomous.run` con un objetivo de prueba.",
  ];
  return lines.join("\n");
}

export async function writeNextPromptFiles(root: string): Promise<string[]> {
  const md = buildPrompt5Markdown();
  const written: string[] = [];
  const targets = [
    path.join(root, ".editcore", "docs", "SIGUIENTE_PROMPT_005.md"),
    path.join(root, "docs", "SIGUIENTE_PROMPT_005.md"),
    path.join(root, ".editcore", "docs", "PROMPT_4_COMPLETADO.md"),
    path.join(root, "docs", "PROMPT_4_COMPLETADO.md"),
  ];

  const completionMd = md.replace(
    "# SIGUIENTE_PROMPT",
    "# PROMPT 4 — COMPLETADO AL 100%\n\n# SIGUIENTE_PROMPT"
  );

  await fs.promises.mkdir(path.join(root, ".editcore", "docs"), { recursive: true });
  await fs.promises.mkdir(path.join(root, "docs"), { recursive: true });

  await fs.promises.writeFile(targets[0], md + "\n", "utf8");
  written.push(targets[0]);
  await fs.promises.writeFile(targets[1], md + "\n", "utf8");
  written.push(targets[1]);
  await fs.promises.writeFile(targets[2], completionMd + "\n", "utf8");
  written.push(targets[2]);
  await fs.promises.writeFile(targets[3], completionMd + "\n", "utf8");
  written.push(targets[3]);

  return written;
}
