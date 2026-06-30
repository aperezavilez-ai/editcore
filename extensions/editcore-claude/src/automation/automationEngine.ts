import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

/**
 * Motor de automatizaciones de EditCore.
 *
 * Límite real e inevitable: esto corre solo dentro de la sesión de VS Code mientras
 * la extensión está activa. No es un proceso en background persistente ni puede
 * recibir webhooks entrantes — no hay servidor. Los triggers disponibles son los que
 * el editor puede observar localmente: guardar un archivo o crear un archivo nuevo
 * que matchee un patrón glob.
 */
export interface AutomationRule {
  id: string;
  trigger: "onSave" | "onCreate";
  glob: string;
  action: "chatPrompt" | "runCommand";
  payload: string;
  enabled?: boolean;
}

function getAutomationsFilePath(): string | undefined {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) return undefined;
  return path.join(root, ".editcore", "automations.json");
}

async function loadRules(): Promise<AutomationRule[]> {
  const filePath = getAutomationsFilePath();
  if (!filePath) return [];
  try {
    const raw = await fs.promises.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as AutomationRule[];
    return Array.isArray(parsed) ? parsed.filter((r) => r.enabled !== false) : [];
  } catch {
    return [];
  }
}

function matchesGlob(relPath: string, glob: string): boolean {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "§§DOUBLESTAR§§")
    .replace(/\*/g, "[^/]*")
    .replace(/§§DOUBLESTAR§§/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`).test(relPath);
}

async function runAction(rule: AutomationRule, filePath: string): Promise<void> {
  if (rule.action === "runCommand") {
    await vscode.commands.executeCommand(rule.payload);
    return;
  }
  if (rule.action === "chatPrompt") {
    const prompt = rule.payload.replace("{file}", filePath);
    await vscode.commands.executeCommand("workbench.action.chat.open", { query: `@claude ${prompt}` });
  }
}

export function registerAutomationEngine(context: vscode.ExtensionContext): void {
  const handle = async (trigger: "onSave" | "onCreate", absPath: string) => {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!root) return;
    const relPath = path.relative(root, absPath).replace(/\\/g, "/");
    const rules = await loadRules();
    for (const rule of rules) {
      if (rule.trigger !== trigger) continue;
      if (!matchesGlob(relPath, rule.glob)) continue;
      try {
        await runAction(rule, relPath);
      } catch (err) {
        vscode.window.showWarningMessage(
          `EditCore: automatización "${rule.id}" falló: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  };

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc) => {
      if (doc.uri.scheme === "file") void handle("onSave", doc.uri.fsPath);
    }),
    vscode.workspace.onDidCreateFiles((e) => {
      for (const uri of e.files) {
        if (uri.scheme === "file") void handle("onCreate", uri.fsPath);
      }
    })
  );
}

export async function openAutomationsConfig(): Promise<void> {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) {
    vscode.window.showWarningMessage("Abre un workspace primero.");
    return;
  }
  const filePath = getAutomationsFilePath()!;
  try {
    await fs.promises.access(filePath);
  } catch {
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    const example: AutomationRule[] = [
      {
        id: "ejemplo-test-on-save",
        trigger: "onSave",
        glob: "src/**/*.ts",
        action: "chatPrompt",
        payload: "Revisá {file} por bugs obvios y casos borde faltantes.",
        enabled: false,
      },
    ];
    await fs.promises.writeFile(filePath, JSON.stringify(example, null, 2), "utf8");
  }
  const doc = await vscode.workspace.openTextDocument(filePath);
  await vscode.window.showTextDocument(doc);
}
