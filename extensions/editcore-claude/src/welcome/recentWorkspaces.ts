import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

export interface RecentWorkspace {
  name: string;
  path: string;
  openedAt: number;
}

const STORAGE_KEY = "editcore.recentWorkspaces";
const MAX_RECENTS = 12;

export function getRecentWorkspaces(context: vscode.ExtensionContext): RecentWorkspace[] {
  const stored = context.globalState.get<RecentWorkspace[]>(STORAGE_KEY, []);
  const merged = [...stored];
  tryMergeVsCodeHistory(merged);
  return dedupeRecents(merged)
    .sort((a, b) => b.openedAt - a.openedAt)
    .slice(0, MAX_RECENTS);
}

export async function rememberWorkspace(
  context: vscode.ExtensionContext,
  folderPath: string
): Promise<void> {
  const normalized = path.normalize(folderPath);
  const name = path.basename(normalized) || normalized;
  const current = context.globalState.get<RecentWorkspace[]>(STORAGE_KEY, []);
  const next = dedupeRecents([
    { name, path: normalized, openedAt: Date.now() },
    ...current.filter((entry) => path.normalize(entry.path) !== normalized),
  ]).slice(0, MAX_RECENTS);
  await context.globalState.update(STORAGE_KEY, next);
}

export function registerRecentWorkspaceTracking(context: vscode.ExtensionContext): void {
  void seedKnownProjects(context);

  const trackOpenFolders = () => {
    for (const folder of vscode.workspace.workspaceFolders ?? []) {
      if (folder.uri.scheme === "file") {
        void rememberWorkspace(context, folder.uri.fsPath);
      }
    }
  };

  trackOpenFolders();
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => trackOpenFolders())
  );
}

async function seedKnownProjects(context: vscode.ExtensionContext): Promise<void> {
  const existing = context.globalState.get<RecentWorkspace[]>(STORAGE_KEY, []);
  if (existing.length > 0) {
    return;
  }
  const candidates = [
    "D:\\EDITCORE",
    "D:\\PROGRAMAS IA\\TAXIDRIV",
    "D:\\PROGRAMAS IA\\IA RESTAURANT",
    "D:\\PROGRAMAS IA\\CONNECTXI",
    "D:\\PROGRAMAS IA\\PODCASTSTUDIO",
  ];
  for (const folderPath of candidates) {
    if (fs.existsSync(folderPath)) {
      await rememberWorkspace(context, folderPath);
    }
  }
}

function dedupeRecents(entries: RecentWorkspace[]): RecentWorkspace[] {
  const seen = new Set<string>();
  const result: RecentWorkspace[] = [];
  for (const entry of entries) {
    const key = path.normalize(entry.path).toLowerCase();
    if (!entry.path || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(entry);
  }
  return result;
}

function tryMergeVsCodeHistory(target: RecentWorkspace[]): void {
  const appData = process.env.APPDATA || process.env.HOME;
  if (!appData) {
    return;
  }
  const storagePath = path.join(appData, "EditCore", "User", "globalStorage", "storage.json");
  if (!fs.existsSync(storagePath)) {
    return;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(storagePath, "utf8")) as Record<string, unknown>;
    const history = raw["history.recentlyOpenedPathsList"] as
      | { entries?: Array<{ folderUri?: string; label?: string }> }
      | undefined;
    for (const entry of history?.entries ?? []) {
      const folderUri = entry.folderUri;
      if (!folderUri || !folderUri.startsWith("file:///")) {
        continue;
      }
      const folderPath = decodeURIComponent(folderUri.replace(/^file:\/\/\//, "").replace(/\//g, "\\"));
      if (!fs.existsSync(folderPath)) {
        continue;
      }
      target.push({
        name: entry.label || path.basename(folderPath),
        path: folderPath,
        openedAt: Date.now() - target.length,
      });
    }
  } catch {
    // Best effort only.
  }
}
