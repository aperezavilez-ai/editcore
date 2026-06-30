import * as vscode from "vscode";
import { candidateDevPorts, detectDevServerSync } from "./projectDevServer";
import { openIntegratedBrowser } from "./localPreview";

const DEV_COMMAND_RE = /\b(npm|pnpm|yarn|bun)\s+(run\s+)?(dev|start)\b|\bnext\s+dev\b|\bvite\b/i;

/**
 * Detecta cuando el usuario corre manualmente un comando de dev server en
 * cualquier terminal (sin pasar por los comandos de EditCore) y abre/recarga
 * el browser integrado en cuanto el puerto responde, igual que hacen otros
 * IDEs basados en VS Code.
 */
export function registerDevServerWatcher(context: vscode.ExtensionContext): void {
  if (!vscode.window.onDidStartTerminalShellExecution) {
    return;
  }

  let watching = false;

  context.subscriptions.push(
    vscode.window.onDidStartTerminalShellExecution((event) => {
      const commandLine = event.execution.commandLine.value;
      if (!DEV_COMMAND_RE.test(commandLine) || watching) {
        return;
      }

      const folder = vscode.workspace.workspaceFolders?.[0];
      if (!folder) {
        return;
      }
      const dev = detectDevServerSync(folder.uri.fsPath);
      const ports = dev ? candidateDevPorts(dev) : [3000, 5173];

      watching = true;
      waitForPortAndOpen(ports).finally(() => {
        watching = false;
      });
    })
  );
}

async function waitForPortAndOpen(ports: number[]): Promise<void> {
  const { findActiveDevPortFromList } = await import("./localPreview");
  const port = await findActiveDevPortFromList(ports, 60_000);
  if (port !== undefined) {
    await openIntegratedBrowser(`http://localhost:${port}`);
  }
}
