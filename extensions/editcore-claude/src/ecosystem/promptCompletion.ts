import * as fs from "fs";
import * as path from "path";

export function buildPrompt7Markdown(): string {
  return [
    "# SIGUIENTE_PROMPT — EDITCORE (Prompt 7 de 21)",
    "",
    "_Prompt 6 completado — Marketplace & Team Collaboration v1.4.0_",
    "",
    "## Verificación",
    "cd extensions/editcore-claude && npm run compile && node --test test/*.test.js",
    "",
    "EditCore: `editcore.ecosystem.openAiHub` · `editcore.ecosystem.openMarketplace`",
    "",
    "Pega **Prompt 7 de 21**. Cierre al 100% obligatorio.",
  ].join("\n");
}

export async function writeNextPromptFiles(root: string): Promise<string[]> {
  const md = buildPrompt7Markdown();
  const paths = [
    path.join(root, ".editcore", "docs", "SIGUIENTE_PROMPT_007.md"),
    path.join(root, "docs", "SIGUIENTE_PROMPT_007.md"),
    path.join(root, ".editcore", "docs", "PROMPT_6_COMPLETADO.md"),
    path.join(root, "docs", "PROMPT_6_COMPLETADO.md"),
  ];
  await fs.promises.mkdir(path.join(root, ".editcore", "docs"), { recursive: true });
  await fs.promises.mkdir(path.join(root, "docs"), { recursive: true });
  const completion = md.replace("# SIGUIENTE_PROMPT", "# PROMPT 6 COMPLETADO\n\n# SIGUIENTE_PROMPT");
  for (const [i, p] of paths.entries()) {
    await fs.promises.writeFile(p, (i < 2 ? md : completion) + "\n", "utf8");
  }
  return paths;
}
