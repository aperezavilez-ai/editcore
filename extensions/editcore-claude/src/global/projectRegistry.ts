import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

export interface RegisteredProject {
  id: string;
  name: string;
  path: string;
  lastOpenedAt: string;
  tags: string[];
  relatedProjectIds: string[];
}

export interface ProjectRegistry {
  version: 1;
  projects: RegisteredProject[];
  updatedAt: string;
}

function registryPath(context: vscode.ExtensionContext): string {
  return path.join(context.globalStorageUri.fsPath, "global-projects.json");
}

async function loadRegistry(context: vscode.ExtensionContext): Promise<ProjectRegistry> {
  const file = registryPath(context);
  try {
    const raw = await fs.promises.readFile(file, "utf8");
    return JSON.parse(raw) as ProjectRegistry;
  } catch {
    return { version: 1, projects: [], updatedAt: new Date().toISOString() };
  }
}

async function saveRegistry(context: vscode.ExtensionContext, reg: ProjectRegistry): Promise<void> {
  await fs.promises.mkdir(path.dirname(registryPath(context)), { recursive: true });
  reg.updatedAt = new Date().toISOString();
  await fs.promises.writeFile(registryPath(context), JSON.stringify(reg, null, 2), "utf8");
}

export async function registerCurrentWorkspace(context: vscode.ExtensionContext): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) return;

  const reg = await loadRegistry(context);
  const normPath = folder.uri.fsPath.toLowerCase();
  const existing = reg.projects.find((p) => p.path.toLowerCase() === normPath);

  if (existing) {
    existing.lastOpenedAt = new Date().toISOString();
    existing.name = folder.name;
  } else {
    reg.projects.push({
      id: `proj-${Date.now()}`,
      name: folder.name,
      path: folder.uri.fsPath,
      lastOpenedAt: new Date().toISOString(),
      tags: [],
      relatedProjectIds: [],
    });
  }

  reg.projects.sort((a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt));
  if (reg.projects.length > 100) reg.projects = reg.projects.slice(0, 100);
  await saveRegistry(context, reg);
}

export async function listRegisteredProjects(
  context: vscode.ExtensionContext
): Promise<RegisteredProject[]> {
  const reg = await loadRegistry(context);
  return reg.projects;
}

export async function linkProjects(
  context: vscode.ExtensionContext,
  projectIdA: string,
  projectIdB: string
): Promise<void> {
  const reg = await loadRegistry(context);
  const a = reg.projects.find((p) => p.id === projectIdA);
  const b = reg.projects.find((p) => p.id === projectIdB);
  if (!a || !b) return;
  if (!a.relatedProjectIds.includes(b.id)) a.relatedProjectIds.push(b.id);
  if (!b.relatedProjectIds.includes(a.id)) b.relatedProjectIds.push(a.id);
  await saveRegistry(context, reg);
}

export function registerProjectRegistry(context: vscode.ExtensionContext): void {
  void registerCurrentWorkspace(context);
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => registerCurrentWorkspace(context))
  );
}
