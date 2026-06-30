import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { candidateDevPorts, detectDevServerSync } from "./projectDevServer";
import { findActivePort, openIntegratedBrowser } from "./localPreview";

const POLL_INTERVAL_MS = 3_000;
const REOPEN_COOLDOWN_MS = 5 * 60_000;

let log: vscode.OutputChannel | undefined;
let statusBar: vscode.StatusBarItem | undefined;
let logFilePath: string | undefined;

/**
 * Escribe el diagnóstico en 3 lugares a la vez (Output channel, barra de
 * estado, archivo en disco) porque en builds portables muy parcheados el
 * Output channel puede no aparecer en el selector de la UI — el archivo en
 * disco es la vía que no depende de ningún render de la UI.
 */
function trace(message: string): void {
  log?.appendLine(message);
  if (statusBar) {
    statusBar.text = `$(globe) EditCore: ${message}`;
    statusBar.show();
  }
  if (logFilePath) {
    try {
      fs.appendFileSync(logFilePath, `${new Date().toISOString()} ${message}\n`);
    } catch {
      // best-effort
    }
  }
}

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
  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1);
  context.subscriptions.push(statusBar);

  const folder = vscode.workspace.workspaceFolders?.[0];
  if (folder) {
    logFilePath = path.join(folder.uri.fsPath, "editcore-dev-watcher.log");
    trace("Watcher registrado (extensión activada).");
    startWatchingFolder(context, folder.uri.fsPath);
    return;
  }

  trace("Sin workspace folder al activar la extensión; esperando a que se abra una carpeta...");
  const sub = vscode.workspace.onDidChangeWorkspaceFolders((e) => {
    const newFolder = e.added[0];
    if (newFolder) {
      sub.dispose();
      logFilePath = path.join(newFolder.uri.fsPath, "editcore-dev-watcher.log");
      startWatchingFolder(context, newFolder.uri.fsPath);
    }
  });
  context.subscriptions.push(sub);
}

function startWatchingFolder(context: vscode.ExtensionContext, root: string): void {
  const dev = detectDevServerSync(root);
  if (!dev) {
    trace(`No se detectó script "dev"/"start" en ${root}/package.json; el watcher no se activa.`);
    return;
  }
  const ports = candidateDevPorts(dev);
  trace(
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
          trace(`Puerto ${activePort} respondiendo (antes no respondía ningún puerto candidato).`);
          if (now - lastOpenedAt > REOPEN_COOLDOWN_MS) {
            lastOpenedAt = now;
            trace(`Abriendo browser integrado en http://localhost:${activePort} ...`);
            await openIntegratedBrowser(`http://localhost:${activePort}`);
          } else {
            trace("Dentro del cooldown de reapertura; no se abre el browser.");
          }
        } else if (!isActive) {
          statusBar!.text = `$(globe) EditCore: vigilando puertos ${ports[0]}-${ports[ports.length - 1]}...`;
          statusBar!.show();
        }
        wasActive = isActive;
      } catch (err) {
        trace(`Error en el ciclo de sondeo: ${err instanceof Error ? err.message : String(err)}`);
      }
      await sleep(POLL_INTERVAL_MS);
    }
  })();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
