/**
 * Aprendizaje de interacciones — Fase 10 (Prompt 5).
 */
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import type { InteractionPreference } from "../knowledge/types";

const PREF_FILE = path.join(".editcore", "knowledge", "preferences.json");

function workspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

async function loadPrefs(root: string): Promise<InteractionPreference[]> {
  const file = path.join(root, PREF_FILE);
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(await fs.promises.readFile(file, "utf8")) as InteractionPreference[];
  } catch {
    return [];
  }
}

async function savePrefs(root: string, prefs: InteractionPreference[]): Promise<void> {
  await fs.promises.mkdir(path.dirname(path.join(root, PREF_FILE)), { recursive: true });
  await fs.promises.writeFile(
    path.join(root, PREF_FILE),
    JSON.stringify(prefs.slice(0, 100), null, 2) + "\n",
    "utf8"
  );
}

export async function recordInteractionPreference(
  action: InteractionPreference["action"],
  detail: string,
  tags: string[] = []
): Promise<void> {
  const root = workspaceRoot();
  if (!root) return;
  const prefs = await loadPrefs(root);
  prefs.unshift({
    at: new Date().toISOString(),
    action,
    detail: detail.slice(0, 500),
    tags,
  });
  await savePrefs(root, prefs);
}

export async function getInteractionPreferencesBlock(): Promise<string> {
  const root = workspaceRoot();
  if (!root) return "";
  const prefs = await loadPrefs(root);
  const relevant = prefs.filter((p) => p.action !== "rejected").slice(0, 8);
  if (relevant.length === 0) return "";
  const lines = ["## Preferencias aprendidas", ""];
  for (const p of relevant) {
    lines.push("- [" + p.action + "] " + p.detail);
  }
  return lines.join("\n");
}
