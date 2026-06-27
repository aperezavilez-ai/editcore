import * as vscode from "vscode";
import { resolveClaudeModelId } from "../models";

const MODEL_KEYS = ["model", "diagnostics.model"] as const;

function collectModelEntries(
  config: vscode.WorkspaceConfiguration,
  key: string
): Array<{ value: string; target: vscode.ConfigurationTarget }> {
  const inspect = config.inspect<string>(key);
  const entries: Array<{ value: string; target: vscode.ConfigurationTarget }> = [];
  if (inspect?.globalValue) {
    entries.push({ value: inspect.globalValue, target: vscode.ConfigurationTarget.Global });
  }
  if (inspect?.workspaceValue) {
    entries.push({ value: inspect.workspaceValue, target: vscode.ConfigurationTarget.Workspace });
  }
  if (inspect?.workspaceFolderValue) {
    entries.push({
      value: inspect.workspaceFolderValue,
      target: vscode.ConfigurationTarget.WorkspaceFolder,
    });
  }
  if (entries.length === 0) {
    const current = config.get<string>(key);
    if (current) {
      entries.push({ value: current, target: vscode.ConfigurationTarget.Global });
    }
  }
  return entries;
}

/** Persiste un modelo Claude válido en todos los scopes donde estaba configurado. */
export async function persistClaudeModelSetting(modelId: string): Promise<void> {
  const resolved = resolveClaudeModelId(modelId);
  const config = vscode.workspace.getConfiguration("editcore");

  for (const key of MODEL_KEYS) {
    const entries = collectModelEntries(config, key);
    if (entries.length === 0) {
      await config.update(key, resolved, vscode.ConfigurationTarget.Global);
      continue;
    }
    for (const { value, target } of entries) {
      if (resolveClaudeModelId(value) !== resolved) {
        await config.update(key, resolved, target);
      }
    }
  }
}

export async function migrateDeprecatedModelSettings(): Promise<boolean> {
  const config = vscode.workspace.getConfiguration("editcore");
  let changed = false;

  for (const key of MODEL_KEYS) {
    for (const { value, target } of collectModelEntries(config, key)) {
      const next = resolveClaudeModelId(value);
      if (next !== value) {
        await config.update(key, next, target);
        changed = true;
      }
    }
  }

  return changed;
}
