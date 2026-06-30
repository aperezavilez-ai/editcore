import * as vscode from "vscode";
import { candidateDevPorts, detectDevServerSync } from "./projectDevServer";
import { findActivePort, openIntegratedBrowser } from "./localPreview";

const POLL_INTERVAL_MS = 3_000;
const REOPEN_COOLDOWN_MS = 5 * 60_000;

/**
 * Sondea en segundo plano los puertos candidatos del dev server del proyecto
 * y abre el browser integrado en cuanto detecta que el servidor pasó de
 * "caído" a "respondiendo" — sin depender de detectar comandos de terminal
 * (esa vía falla en muchos shells, ej. Windows PowerShell sin PSReadLine
 * reciente, donde el shell integration de VS Code no llega a activarse).
 */
export function registerDevServerWatcher(context: vscode.ExtensionContext): void {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    return;
  }
  const dev = detectDevServerSync(folder.uri.fsPath);
  if (!dev) {
    return;
  }
  const ports = candidateDevPorts(dev);

  let wasActive = false;
  let lastOpenedAt = 0;
  let disposed = false;

  context.subscriptions.push({ dispose: () => (disposed = true) });

  void (async function poll() {
    while (!disposed) {
      try {
        const activePort = await findActivePort(ports);
        const isActive = activePort !== undefined;
        const now = Date.now();
        if (isActive && !wasActive && now - lastOpenedAt > REOPEN_COOLDOWN_MS) {
          lastOpenedAt = now;
          await openIntegratedBrowser(`http://localhost:${activePort}`);
        }
        wasActive = isActive;
      } catch {
        // El sondeo es best-effort; un error puntual no debe detener el ciclo.
      }
      await sleep(POLL_INTERVAL_MS);
    }
  })();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
