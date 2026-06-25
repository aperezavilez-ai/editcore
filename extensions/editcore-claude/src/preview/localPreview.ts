import * as http from "http";
import * as vscode from "vscode";
import { candidateDevPorts, detectDevServerSync } from "./projectDevServer";

const DEV_TERMINAL_NAME = "EditCore — Dev Server";

export async function openIntegratedBrowser(url: string): Promise<void> {
  const origin = safeOrigin(url);
  await vscode.commands.executeCommand("workbench.action.browser.open", {
    url,
    reuseUrlFilter: origin ?? url,
  });
}

export async function startLocalPreview(): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    vscode.window.showWarningMessage("Abre una carpeta de proyecto primero.");
    return;
  }

  const dev = detectDevServerSync(folder.uri.fsPath);
  if (!dev) {
    const openEmpty = await vscode.window.showWarningMessage(
      "No hay script dev en package.json. ¿Abrir el browser vacío?",
      "Abrir browser"
    );
    if (openEmpty === "Abrir browser") {
      await vscode.commands.executeCommand("workbench.action.browser.openOrList");
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

  let terminal = vscode.window.terminals.find((t) => t.name === DEV_TERMINAL_NAME);
  if (!terminal) {
    terminal = vscode.window.createTerminal({
      name: DEV_TERMINAL_NAME,
      cwd: folder.uri.fsPath,
    });
    terminal.show();
    terminal.sendText(dev.command);
  } else {
    terminal.show();
  }

  const ready = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Iniciando servidor — ${url}`,
      cancellable: true,
    },
    async (_progress, token) => waitForAnyPort(ports, 90_000, token)
  );

  if (ready !== undefined) {
    const readyUrl = `http://localhost:${ready}`;
    await openIntegratedBrowser(readyUrl);
    vscode.window.showInformationMessage(`EditCore: servidor listo — ${readyUrl}`);
  } else {
    const choice = await vscode.window.showWarningMessage(
      `El servidor no respondió a tiempo. Puedes abrir ${url} cuando esté listo.`,
      "Abrir URL"
    );
    if (choice === "Abrir URL") {
      await openIntegratedBrowser(url);
    }
  }
}

export async function findActiveDevPort(root: string): Promise<number | undefined> {
  const dev = detectDevServerSync(root);
  if (!dev) {
    return undefined;
  }
  return findActivePort(candidateDevPorts(dev));
}

async function findActivePort(ports: number[]): Promise<number | undefined> {
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
    await sleep(1000);
  }
  return undefined;
}

function isPortReady(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}`, (res) => {
      res.resume();
      resolve(true);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
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
