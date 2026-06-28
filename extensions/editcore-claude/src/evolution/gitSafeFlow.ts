/**
 * Flujo Git seguro — Fase 6/7 Evolution Execution System.
 */
import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import * as vscode from "vscode";
import { getAutonomyLevel, levelAllowsAction } from "../autonomy/autonomyLevel";

const execAsync = promisify(exec);

export interface GitBranchResult {
  created: boolean;
  branchName: string;
  output: string;
}

function workspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

export function defaultEvolutionBranchName(): string {
  const d = new Date();
  const stamp = d.toISOString().slice(0, 10).replace(/-/g, "");
  return "editcore/evolution-" + stamp;
}

export async function isGitRepo(root: string): Promise<boolean> {
  try {
    await execAsync("git rev-parse --is-inside-work-tree", { cwd: root });
    return true;
  } catch {
    return false;
  }
}

export async function getCurrentBranch(root: string): Promise<string | undefined> {
  try {
    const { stdout } = await execAsync("git branch --show-current", { cwd: root });
    return stdout.trim() || undefined;
  } catch {
    return undefined;
  }
}

export async function createEvolutionBranch(
  root: string,
  branchName?: string
): Promise<GitBranchResult> {
  const name = branchName?.trim() || defaultEvolutionBranchName();
  if (!(await isGitRepo(root))) {
    return { created: false, branchName: name, output: "No es repositorio git." };
  }

  try {
    const { stdout } = await execAsync(`git checkout -b ${name}`, { cwd: root });
    return { created: true, branchName: name, output: stdout.trim() || `Rama creada: ${name}` };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    try {
      const { stdout } = await execAsync(`git checkout ${name}`, { cwd: root });
      return { created: false, branchName: name, output: `Rama existente: ${name}\n${stdout}` };
    } catch {
      return { created: false, branchName: name, output: `Error git branch: ${message}` };
    }
  }
}

export async function ensureSafeGitBranchBeforeWrites(): Promise<GitBranchResult | undefined> {
  const config = vscode.workspace.getConfiguration("editcore");
  if (!config.get<boolean>("evolution.gitBranchBeforeChanges", true)) {
    return undefined;
  }

  const level = getAutonomyLevel();
  if (!levelAllowsAction(level, "write_approved")) {
    return undefined;
  }

  const root = workspaceRoot();
  if (!root) {
    return undefined;
  }

  const current = await getCurrentBranch(root);
  if (current?.startsWith("editcore/evolution-")) {
    return { created: false, branchName: current, output: `Ya en rama de evolución: ${current}` };
  }

  if (current === "main" || current === "master") {
    const choice = await vscode.window.showWarningMessage(
      `Cambios en rama «${current}». ¿Crear rama de evolución?`,
      "Crear rama",
      "Continuar en " + current,
      "Cancelar"
    );
    if (choice === "Cancelar") {
      throw new Error("Operación cancelada: se requiere rama segura.");
    }
    if (choice === "Crear rama") {
      return createEvolutionBranch(root);
    }
  }

  return undefined;
}

export async function execGitBranch(input: {
  name?: string;
  checkout_only?: boolean;
}): Promise<string> {
  const root = workspaceRoot();
  if (!root) {
    return "ERROR: sin workspace.";
  }
  if (!(await isGitRepo(root))) {
    return "ERROR: no es repositorio git.";
  }

  const name = input.name?.trim() || defaultEvolutionBranchName();

  if (input.checkout_only) {
    const { stdout } = await execAsync(`git checkout ${name}`, { cwd: root });
    return stdout.trim() || `Checkout: ${name}`;
  }

  const result = await createEvolutionBranch(root, name);
  return result.output;
}

const BRANCH_MARKER = path.join(".editcore", "git", "active-evolution-branch.txt");

export async function recordActiveBranch(root: string, branchName: string): Promise<void> {
  const markerPath = path.join(root, BRANCH_MARKER);
  await fs.promises.mkdir(path.dirname(markerPath), { recursive: true });
  await fs.promises.writeFile(
    markerPath,
    JSON.stringify({ branch: branchName, at: new Date().toISOString() }, null, 2) + "\n",
    "utf8"
  );
}
