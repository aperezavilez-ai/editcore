import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import type { HealthReport, SystemSnapshot } from "./types";
import { formatHealthReportMarkdown } from "./healthMonitor";
import { formatSystemSnapshotMarkdown } from "./systemReader";

export interface GenerateSystemMapResult {
  workspacePath: string;
  relativePath: string;
}

function workspaceDocsDir(): string | undefined {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) {
    return undefined;
  }
  return path.join(root, ".editcore", "docs");
}

export function buildSystemMapDocument(
  snapshot: SystemSnapshot,
  health: HealthReport
): string {
  const statusLabel =
    health.status === "healthy" ? "Saludable" : health.status === "degraded" ? "Degradado" : "Crítico";

  return [
    "# EDITCORE System Map (generado en vivo)",
    "",
    `_Generado: ${new Date().toISOString()}_`,
    `_Producto v${snapshot.productVersion} · Extensión v${snapshot.extensionVersion}_`,
    `_Estado: ${statusLabel}_`,
    "",
    "> Documento generado automáticamente por EditCore System Intelligence Layer.",
    "> No editar manualmente si vas a regenerar; usa `editcore.intelligence.generateSystemMap`.",
    "",
    formatSystemSnapshotMarkdown(snapshot),
    "",
    "---",
    "",
    formatHealthReportMarkdown(health),
  ].join("\n");
}

export async function writeSystemMapToWorkspace(
  snapshot: SystemSnapshot,
  health: HealthReport
): Promise<GenerateSystemMapResult> {
  const docsDir = workspaceDocsDir();
  if (!docsDir) {
    throw new Error("Abre una carpeta de workspace para guardar el mapa del sistema.");
  }

  await fs.promises.mkdir(docsDir, { recursive: true });
  const relativePath = path.join(".editcore", "docs", "EDITCORE_SYSTEM_MAP.md");
  const fullPath = path.join(docsDir, "EDITCORE_SYSTEM_MAP.md");
  const content = buildSystemMapDocument(snapshot, health);
  await fs.promises.writeFile(fullPath, content, "utf8");

  return {
    workspacePath: fullPath,
    relativePath,
  };
}
