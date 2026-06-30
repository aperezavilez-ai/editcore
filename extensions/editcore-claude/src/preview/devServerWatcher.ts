import * as vscode from "vscode";
import { candidateDevPorts, detectDevServerSync } from "./projectDevServer";
import { findActivePort, openIntegratedBrowser } from "./localPreview";

const POLL_INTERVAL_MS = 3_000;
const REOPEN_COOLDOWN_MS = 5 * 60_000;

let log: vscode.OutputChannel | undefined;

/**
 * Sondea en segundo plano los puertos candidatos del dev server del proyecto
 * y abre el browser integrado en cuanto detecta que el servidor pasó de
 * "caído" a "respondiendo" — sin depender de detectar comandos de terminal
 * (esa vía falla en muchos shells, ej. Windows PowerShell sin PSReadLine
 * reciente, donde el shell integration de VS Code no llega a activarse).
 *
 * No asume que el workspace folder ya está disponible en el momento exacto
 * de la activación de la extensión: si todavía no hay carpeta abierta,
 * espera al evento `onDidChangeWorkspaceFolders` en vez de no hacer nada.
 */
export function registerDevServerWatcher(context: vscode.ExtensionContext): void {
  log = vscode.window.createOutputChannel("EditCore: Dev Server Watcher");
  context.subscriptions.push(log);

  const folder = vscode.workspace.workspaceFolders?.[0];
  if (folder) {
    startWatchingFolder(context, folder.uri.fsPath);
    return;
  }

  log.appendLine("Sin workspace folder al activar la extensión; esperando a que se abra una carpeta...");
  const sub = vscode.workspace.onDidChangeWorkspaceFolders((e) => {
    const newFolder = e.added[0];
    if (newFolder) {
      sub.dispose();
      startWatchingFolder(context, newFolder.uri.fsPath);
    }
  });
  context.subscriptions.push(sub);
}

function startWatchingFolder(context: vscode.ExtensionContext, root: string): void {
  const dev = detectDevServerSync(root);
  if (!dev) {
    log?.appendLine(`No se detectó script "dev"/"start" en ${root}/package.json; el watcher no se activa.`);
    return;
  }
  const ports = candidateDevPorts(dev);
  log?.appendLine(
    `Watcher activo para ${root} (framework: ${dev.framework ?? "desconocido"}, comando: ${dev.command}). Puertos a sondear: ${ports.join(", ")}.`
  );

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
        if (isActive && !wasActive) {
          log?.appendLine(`Puerto ${activePort} respondiendo (antes no respondía ningún puerto candidato).`);
          if (now - lastOpenedAt > REOPEN_COOLDOWN_MS) {
            lastOpenedAt = now;
            log?.appendLine(`Abriendo browser integrado en http://localhost:${activePort} ...`);
            await openIntegratedBrowser(`http://localhost:${activePort}`);
          } else {
            log?.appendLine("Dentro del cooldown de reapertura; no se abre el browser.");
          }
        }
        wasActive = isActive;
      } catch (err) {
        log?.appendLine(`Error en el ciclo de sondeo: ${err instanceof Error ? err.message : String(err)}`);
      }
      await sleep(POLL_INTERVAL_MS);
    }
  })();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
