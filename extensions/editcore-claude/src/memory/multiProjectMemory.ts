/**
 * Memoria multiproyecto — Fase 9 (Prompt 5).
 */
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { getGlobalMemoryContext } from "../global/globalMemory";

const REGISTRY = path.join(".editcore", "knowledge", "project-registry.json");

export interface ProjectMemoryScope {
  projectId: string;
  projectPath: string;
  projectName: string;
  lastActiveAt: string;
}

function workspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function projectIdFromPath(p: string): string {
  return Buffer.from(p.toLowerCase()).toString("base64url").slice(0, 24);
}

export async function registerActiveProject(): Promise<ProjectMemoryScope | undefined> {
  const root = workspaceRoot();
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!root || !folder) return undefined;

  const scope: ProjectMemoryScope = {
    projectId: projectIdFromPath(root),
    projectPath: root,
    projectName: folder.name,
    lastActiveAt: new Date().toISOString(),
  };

  const filePath = path.join(root, REGISTRY);
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath, JSON.stringify(scope, null, 2) + "\n", "utf8");
  return scope;
}

export async function getProjectScopedMemoryBlock(
  context: vscode.ExtensionContext,
  query: string
): Promise<string> {
  const root = workspaceRoot();
  if (!root) return "";

  await registerActiveProject();

  const globalBlock = await getGlobalMemoryContext(context, query);
  if (!globalBlock) return "";

  const folder = vscode.workspace.workspaceFolders?.[0];
  return [
    "## Memoria global (proyecto: " + (folder?.name ?? "workspace") + ")",
    "_Solo entradas relevantes a este proyecto o patrones compartidos._",
    "",
    globalBlock.slice(0, 1500),
  ].join("\n");
}
