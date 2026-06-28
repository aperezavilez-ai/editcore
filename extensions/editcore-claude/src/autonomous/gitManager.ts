/**
 * EDITCORE GIT MANAGER — Fase 7 (Prompt 4).
 */
import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import * as vscode from "vscode";
import {
  createEvolutionBranch,
  getCurrentBranch,
  isGitRepo,
  recordActiveBranch,
} from "../evolution/gitSafeFlow";
import { confirmCriticalAction } from "./autonomousSecurity";

const execAsync = promisify(exec);

export interface GitBackupResult {
  branchName: string;
  stashCreated: boolean;
  restorePointPath?: string;
  output: string;
}

export interface GitCommitResult {
  committed: boolean;
  message: string;
  output: string;
}

function workspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

export function defaultTaskBranchName(taskId: string): string {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const short = taskId.replace(/[^a-z0-9]/gi, "").slice(0, 12).toLowerCase();
  return "editcore/work-" + stamp + "-" + short;
}

export async function createRestorePoint(root: string, taskId: string): Promise<string | undefined> {
  if (!(await isGitRepo(root))) {
    return undefined;
  }
  const markerDir = path.join(root, ".editcore", "git", "restore-points");
  await fs.promises.mkdir(markerDir, { recursive: true });
  const markerPath = path.join(markerDir, taskId + ".json");

  let stashRef: string | undefined;
  try {
    const { stdout: status } = await execAsync("git status --porcelain", { cwd: root });
    if (status.trim()) {
      const confirmed = await confirmCriticalAction("Crear stash como punto de restauración");
      if (confirmed) {
        const { stdout } = await execAsync('git stash push -m "editcore-restore-' + taskId + '"', {
          cwd: root,
        });
        stashRef = stdout.trim();
      }
    }
  } catch {
    // ignore stash errors
  }

  const branch = await getCurrentBranch(root);
  const payload = {
    taskId,
    branch,
    stashRef,
    at: new Date().toISOString(),
  };
  await fs.promises.writeFile(markerPath, JSON.stringify(payload, null, 2) + "\n", "utf8");
  return markerPath;
}

export async function ensureTaskGitBranch(
  root: string,
  taskId: string
): Promise<GitBackupResult> {
  if (!(await isGitRepo(root))) {
    return {
      branchName: "",
      stashCreated: false,
      output: "No es repositorio git.",
    };
  }

  const restorePointPath = await createRestorePoint(root, taskId);
  const branchName = defaultTaskBranchName(taskId);
  const result = await createEvolutionBranch(root, branchName);
  await recordActiveBranch(root, result.branchName);

  return {
    branchName: result.branchName,
    stashCreated: Boolean(restorePointPath),
    restorePointPath,
    output: result.output,
  };
}

export async function getDiffSummary(root: string): Promise<string> {
  if (!(await isGitRepo(root))) {
    return "No es repositorio git.";
  }
  try {
    const { stdout: stat } = await execAsync("git diff --stat", { cwd: root });
    const { stdout: names } = await execAsync("git diff --name-only", { cwd: root });
    return "Archivos modificados:\n" + names.trim() + "\n\n" + stat.trim();
  } catch (err: unknown) {
    return err instanceof Error ? err.message : String(err);
  }
}

export function buildCommitMessage(objective: string, files: string[]): string {
  const shortObj = objective.slice(0, 72).replace(/\n/g, " ");
  const scope = files.length ? files.slice(0, 3).join(", ") : "workspace";
  return "feat(autonomous): " + shortObj + "\n\nArchivos: " + scope + "\n\nGenerado por EditCore Autonomous Developer Engine.";
}

export async function createAutonomousCommit(
  root: string,
  objective: string,
  modifiedFiles: string[]
): Promise<GitCommitResult> {
  if (!(await isGitRepo(root))) {
    return { committed: false, message: "", output: "No es repositorio git." };
  }

  const confirmed = await confirmCriticalAction("Crear commit autónomo con los cambios actuales");
  if (!confirmed) {
    return { committed: false, message: "", output: "Commit cancelado por el usuario." };
  }

  const message = buildCommitMessage(objective, modifiedFiles);
  try {
    await execAsync("git add -A", { cwd: root });
    const { stdout } = await execAsync('git commit -m "' + message.replace(/"/g, '\\"') + '"', {
      cwd: root,
    });
    return { committed: true, message, output: stdout.trim() };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { committed: false, message, output: "Error commit: " + msg };
  }
}

export async function tryCreatePullRequest(
  root: string,
  title: string,
  body: string
): Promise<string> {
  if (!(await isGitRepo(root))) {
    return "No es repositorio git.";
  }
  try {
    await execAsync("gh --version", { cwd: root });
  } catch {
    return "GitHub CLI (gh) no disponible. Crea el PR manualmente.";
  }

  const confirmed = await confirmCriticalAction("Crear Pull Request con gh cli");
  if (!confirmed) {
    return "PR cancelado por el usuario.";
  }

  try {
    const branch = await getCurrentBranch(root);
    const { stdout } = await execAsync(
      'gh pr create --title "' +
        title.replace(/"/g, '\\"') +
        '" --body "' +
        body.replace(/"/g, '\\"').slice(0, 2000) +
        '"',
      { cwd: root }
    );
    return stdout.trim();
  } catch (err: unknown) {
    return "Error PR: " + (err instanceof Error ? err.message : String(err));
  }
}

export async function collectModifiedFiles(root: string): Promise<string[]> {
  if (!(await isGitRepo(root))) {
    return [];
  }
  try {
    const { stdout } = await execAsync("git diff --name-only", { cwd: root });
    return stdout
      .trim()
      .split("\n")
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function getWorkspaceRootForGit(): string | undefined {
  return workspaceRoot();
}
