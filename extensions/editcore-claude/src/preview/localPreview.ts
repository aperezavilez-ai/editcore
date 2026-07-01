import * as http from "http";
import * as vscode from "vscode";
import { candidateDevPorts, detectDevServerSync } from "./projectDevServer";

const DEV_TERMINAL_NAME = "EditCore — Dev Server";
const FALLBACK_PORTS = [3000, 5173, 8080, 4200, 8000];

export async function openIntegratedBrowser(url: string): Promise<void> {
  const origin = safeOrigin(url);
  await vscode.commands.executeCommand("workbench.action.browser.open", {
    url,
    reuseUrlFilter: origin ?? url,
  });
}

/** Abre el browser con la URL del dev server (nunca vacío si hay proyecto). */
export async function openBrowserSmart(): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    const url = await vscode.window.showInputBox({
      prompt: "URL para el browser integrado",
      value: "http://localhost:3000",
      placeHolder: "https://…",
    });
    if (url?.trim()) {
      await openIntegratedBrowser(url.trim());
    }
    return;
  }

  const dev = detectDevServerSync(folder.uri.fsPath);
  const ports = dev ? candidateDevPorts(dev) : [...FALLBACK_PORTS];
  let activePort = await findActivePort(ports);

  if (activePort === undefined && vscode.window.terminals.length > 0) {
    activePort = await waitForAnyPort(ports, 15_000, new vscode.CancellationTokenSource().token);
  }

  if (activePort !== undefined) {
    await openIntegratedBrowser(`http://localhost:${activePort}`);
    return;
  }

  if (dev) {
    await startLocalPreview();
    return;
  }

  const guessed = `http://localhost:${ports[0]}`;
  await openIntegratedBrowser(guessed);
  vscode.window.showInformationMessage(
    `EditCore: browser en ${guessed}. Si no carga, inicia tu servidor y pulsa Recargar en el browser.`
  );
}

export async function startLocalPreview(): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    vscode.window.showWarningMessage("Abre una carpeta de proyecto primero.");
    return;
  }

  const dev = detectDevServerSync(folder.uri.fsPath);
  if (!dev) {
    const url = await vscode.window.showInputBox({
      prompt: "No hay script dev. URL del browser:",
      value: "http://localhost:3000",
    });
    if (url?.trim()) {
      await openIntegratedBrowser(url.trim());
    }
    return;
  }

  const ports = candidateDevPorts(dev);
  const activePort = await findActivePort(ports);
  if (activePort !== undefined) {
    const url = `http://localhost:${activePort}`;
    await openIntegratedBrowser(url);
    vscode.window.showInformationMessage(`EditCore: preview en ${url}`);
    return;
  }

  const url = `http://localhost:${dev.port}`;
  await openIntegratedBrowser(url);

  const hasRunningDev = vscode.window.terminals.some(
    (t) => t.name === DEV_TERMINAL_NAME || /dev|next|vite|npm/i.test(t.name)
  );

  if (!hasRunningDev) {
    const terminal = vscode.window.createTerminal({
      name: DEV_TERMINAL_NAME,
      cwd: dev.cwd,
    });
    terminal.show(true);
    terminal.sendText(dev.command);
  }

  const ready = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Esperando servidor — ${url}`,
      cancellable: true,
    },
    async (_progress, token) => waitForAnyPort(ports, 90_000, token)
  );

  if (ready !== undefined) {
    const readyUrl = `http://localhost:${ready}`;
    if (ready !== dev.port) {
      await openIntegratedBrowser(readyUrl);
    } else {
      await vscode.commands.executeCommand("workbench.action.browser.reload");
    }
    vscode.window.showInformationMessage(`EditCore: servidor listo — ${readyUrl}`);
  } else {
    vscode.window.showWarningMessage(
      `El servidor no respondió a tiempo. El browser ya está en ${url}; recarga cuando esté listo.`
    );
  }
}

export async function findActiveDevPort(root: string): Promise<number | undefined> {
  const dev = detectDevServerSync(root);
  if (!dev) {
    return undefined;
  }
  return findActivePort(candidateDevPorts(dev));
}

export async function findActivePort(ports: number[]): Promise<number | undefined> {
  for (const port of ports) {
    if (await isPortReady(port)) {
      return port;
    }
  }
  return undefined;
}

async function waitForAnyPort(
  ports: number[],
  timeoutMs: number,
  token: vscode.CancellationToken
): Promise<number | undefined> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (token.isCancellationRequested) {
      return undefined;
    }
    const active = await findActivePort(ports);
    if (active !== undefined) {
      return active;
    }
    await sleep(800);
  }
  return undefined;
}

function isPortReady(port: number): Promise<boolean> {
  return probeHost("127.0.0.1", port).then((ok) => (ok ? true : probeHost("localhost", port)));
}

function probeHost(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.request(
      { host, port, path: "/", method: "GET", timeout: 2500 },
      (res) => {
        res.resume();
        resolve(res.statusCode !== undefined && res.statusCode < 600);
      }
    );
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

function safeOrigin(url: string): string | undefined {
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}