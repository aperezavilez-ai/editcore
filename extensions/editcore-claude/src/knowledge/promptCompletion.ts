import * as fs from "fs";
import * as path from "path";

export function buildPrompt6Markdown(): string {
  return [
    "# SIGUIENTE_PROMPT — EDITCORE (Prompt 6 de 21)",
    "",
    "_Generado tras completar Prompt 5 — Knowledge & Memory System v1.3.0_",
    "",
    "**Fecha:** " + new Date().toISOString(),
    "",
    "## Prompt 5 — COMPLETADO",
    "",
    "Fases 1–13 implementadas: Project Knowledge Engine, indexación, RAG unificado, memoria conversación/arquitectura/cambios, context assembler, análisis semántico, multiproyecto, aprendizaje de interacciones, seguridad, Knowledge Center, optimización tokens.",
    "",
    "## Verificación",
    "",
    "```powershell",
    "cd extensions/editcore-claude",
    "npm run compile",
    "node --test test/*.test.js",
    "```",
    "",
    "En EditCore: `editcore.knowledge.reindex` → `editcore.knowledge.openCenter`",
    "",
    "## Instrucción",
    "",
    "Pega **Prompt 6 de 21**. Cierre al 100% obligatorio.",
  ].join("\n");
}

export async function writeNextPromptFiles(root: string): Promise<string[]> {
  const md = buildPrompt6Markdown();
  const paths = [
    path.join(root, ".editcore", "docs", "SIGUIENTE_PROMPT_006.md"),
    path.join(root, "docs", "SIGUIENTE_PROMPT_006.md"),
    path.join(root, ".editcore", "docs", "PROMPT_5_COMPLETADO.md"),
    path.join(root, "docs", "PROMPT_5_COMPLETADO.md"),
  ];
  await fs.promises.mkdir(path.join(root, ".editcore", "docs"), { recursive: true });
  await fs.promises.mkdir(path.join(root, "docs"), { recursive: true });
  const completion = md.replace("# SIGUIENTE_PROMPT", "# PROMPT 5 COMPLETADO\n\n# SIGUIENTE_PROMPT");
  for (const [i, p] of paths.entries()) {
    await fs.promises.writeFile(p, (i < 2 ? md : completion) + "\n", "utf8");
  }
  return paths;
}
