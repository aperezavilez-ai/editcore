/**
 * Version control integrado — Fase 9 (Prompt 6).
 */
import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import * as vscode from "vscode";
import type { VersionSnapshot } from "./types";

const execAsync = promisify(exec);
const VERSIONS_DIR = path.join(".editcore", "versions");

function workspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

export async function createVersionSnapshot(label: string, note?: string): Promise<VersionSnapshot> {
  const root = workspaceRoot();
  if (!root) throw new Error("Sin workspace.");

  let gitCommit: string | undefined;
  let files: string[] = [];
  try {
    const { stdout: commit } = await execAsync("git rev-parse --short HEAD", { cwd: root });
    gitCommit = commit.trim();
    const { stdout: names } = await execAsync("git diff --name-only HEAD", { cwd: root });
    files = names.trim().split("\n").filter(Boolean);
  } catch {
    // no git
  }

  const snapshot: VersionSnapshot = {
    id: "ver-" + Date.now(),
    label,
    at: new Date().toISOString(),
    gitCommit,
    files,
    note,
  };

  const dir = path.join(root, VERSIONS_DIR);
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(path.join(dir, snapshot.id + ".json"), JSON.stringify(snapshot, null, 2) + "\n", "utf8");

  if (gitCommit) {
    try {
      await execAsync('git tag editcore-snapshot-' + snapshot.id.replace("ver-", ""), { cwd: root });
    } catch {
      // optional
    }
  }

  return snapshot;
}

export async function listVersionSnapshots(): Promise<VersionSnapshot[]> {
  const root = workspaceRoot();
  if (!root) return [];
  const dir = path.join(root, VERSIONS_DIR);
  if (!fs.existsSync(dir)) return [];
  const files = await fs.promises.readdir(dir);
  const snaps: VersionSnapshot[] = [];
  for (const f of files.filter((x) => x.endsWith(".json"))) {
    try {
      snaps.push(JSON.parse(await fs.promises.readFile(path.join(dir, f), "utf8")) as VersionSnapshot);
    } catch {
      // skip
    }
  }
  return snaps.sort((a, b) => b.at.localeCompare(a.at));
}

export async function compareWithSnapshot(snapshotId: string): Promise<string> {
  const root = workspaceRoot();
  if (!root) return "Sin workspace.";
  const file = path.join(root, VERSIONS_DIR, snapshotId + ".json");
  if (!fs.existsSync(file)) return "Snapshot no encontrado.";
  const snap = JSON.parse(await fs.promises.readFile(file, "utf8")) as VersionSnapshot;
  if (!snap.gitCommit) return "Snapshot sin commit git.";
  try {
    const { stdout } = await execAsync("git diff " + snap.gitCommit + " HEAD --stat", { cwd: root });
    return stdout.trim() || "Sin diferencias.";
  } catch (err: unknown) {
    return err instanceof Error ? err.message : String(err);
  }
}

export async function restoreFromGitRef(ref: string): Promise<string> {
  const root = workspaceRoot();
  if (!root) throw new Error("Sin workspace.");
  const choice = await vscode.window.showWarningMessage(
    "¿Restaurar a " + ref + "? Esto puede perder cambios no commiteados.",
    { modal: true },
    "Restaurar",
    "Cancelar"
  );
  if (choice !== "Restaurar") return "Cancelado.";
  const { stdout } = await execAsync("git checkout " + ref, { cwd: root });
  return stdout.trim() || "Restaurado.";
}
