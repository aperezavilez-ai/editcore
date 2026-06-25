import * as vscode from "vscode";
import { getRecentWorkspaces, rememberWorkspace, type RecentWorkspace } from "./recentWorkspaces";

let currentPanel: vscode.WebviewPanel | undefined;

export function registerWelcomePanel(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("editcore.showWelcome", () => showWelcomePanel(context)),
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      if (vscode.workspace.workspaceFolders?.length) {
        currentPanel?.dispose();
      }
    })
  );
}

export async function showWelcomeIfNeeded(context: vscode.ExtensionContext): Promise<void> {
  if (vscode.workspace.workspaceFolders?.length || vscode.workspace.workspaceFile) {
    return;
  }
  await showWelcomePanel(context);
}

async function showWelcomePanel(context: vscode.ExtensionContext): Promise<void> {
  if (currentPanel) {
    currentPanel.reveal(vscode.ViewColumn.One);
    await pushState(context);
    return;
  }

  currentPanel = vscode.window.createWebviewPanel(
    "editcoreWelcome",
    "EditCore",
    { viewColumn: vscode.ViewColumn.One, preserveFocus: false },
    { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [context.extensionUri] }
  );

  const panel = currentPanel;
  panel.iconPath = vscode.Uri.joinPath(context.extensionUri, "media", "editcore-activity.png");
  panel.webview.html = getHtml(panel.webview, context);

  panel.webview.onDidReceiveMessage(async (msg) => {
    try {
      if (msg.type === "openFolder") {
        await vscode.commands.executeCommand("workbench.action.files.openFolder");
      } else if (msg.type === "cloneRepo") {
        await vscode.commands.executeCommand("git.clone");
      } else if (msg.type === "connectSsh") {
        await tryConnectSsh();
      } else if (msg.type === "openRecent" && msg.path) {
        const folder = String(msg.path);
        if (folder) {
          await rememberWorkspace(context, folder);
          await vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(folder), false);
        }
      } else if (msg.type === "openAllRecent") {
        await vscode.commands.executeCommand("workbench.action.openRecent");
      } else if (msg.type === "configureApis") {
        try {
          await vscode.commands.executeCommand("editcoreConnect.openApis");
        } catch {
          await vscode.commands.executeCommand("editcore.openAccountPanel");
        }
      } else if (msg.type === "refresh") {
        await pushState(context);
      }
    } catch (err: unknown) {
      const text = err instanceof Error ? err.message : String(err);
      panel.webview.postMessage({ type: "error", text });
    }
  });

  panel.onDidDispose(() => {
    if (currentPanel === panel) {
      currentPanel = undefined;
    }
  });

  await pushState(context);
}

async function tryConnectSsh(): Promise<void> {
  const commands = [
    "opensshremotes.openEmptyWindow",
    "remote-ssh.openEmptyWindow",
    "workbench.action.remote.showMenu",
  ];
  for (const command of commands) {
    try {
      await vscode.commands.executeCommand(command);
      return;
    } catch {
      // Try next built-in / optional remote command.
    }
  }
  const choice = await vscode.window.showInformationMessage(
    "Para conectar por SSH instala la extensión Remote - SSH desde el marketplace, o usa Terminal integrada.",
    "Abrir marketplace"
  );
  if (choice === "Abrir marketplace") {
    await vscode.commands.executeCommand("workbench.extensions.search", "ms-vscode-remote.remote-ssh");
  }
}

async function pushState(context: vscode.ExtensionContext): Promise<void> {
  if (!currentPanel) {
    return;
  }
  const recents = getRecentWorkspaces(context);
  currentPanel.webview.postMessage({
    type: "state",
    recents: recents.map(formatRecent),
  });
}

function formatRecent(entry: RecentWorkspace): { name: string; path: string; parent: string } {
  const parent = entry.path.replace(/[/\\][^/\\]+$/, "") || entry.path;
  return { name: entry.name, path: entry.path, parent };
}

function getHtml(webview: vscode.Webview, context: vscode.ExtensionContext): string {
  const logoUri = webview.asWebviewUri(
    vscode.Uri.joinPath(context.extensionUri, "media", "editcore-icon.svg")
  );
  const csp = `default-src 'none'; img-src ${webview.cspSource} https: data:; style-src 'unsafe-inline'; script-src 'unsafe-inline';`;

  return /* html */ `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<style>
  :root {
    color-scheme: dark light;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--vscode-font-family, system-ui, sans-serif);
    background: var(--vscode-editor-background, #1e1e1e);
    color: var(--vscode-foreground, #ccc);
    padding: 32px 20px 48px;
  }
  .wrap { width: min(920px, 100%); }
  .brand {
    display: flex; flex-direction: column; align-items: center; gap: 10px;
    margin-bottom: 28px;
  }
  .brand img { width: 56px; height: 56px; opacity: .95; }
  .brand h1 {
    margin: 0; font-size: 28px; font-weight: 700; letter-spacing: .12em;
  }
  .brand p { margin: 0; opacity: .65; font-size: 13px; }
  .cards {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14px;
    margin-bottom: 28px;
  }
  .card {
    background: var(--vscode-sideBar-background, #252526);
    border: 1px solid var(--vscode-panel-border, rgba(128,128,128,.28));
    border-radius: 10px;
    padding: 22px 16px;
    cursor: pointer;
    text-align: center;
    transition: background .15s, border-color .15s, transform .1s;
  }
  .card:hover {
    background: var(--vscode-list-hoverBackground, #2a2d2e);
    border-color: var(--vscode-focusBorder, #007fd4);
    transform: translateY(-1px);
  }
  .card .icon { font-size: 28px; margin-bottom: 10px; }
  .card .title { font-size: 14px; font-weight: 600; }
  .recent-head {
    display: flex; align-items: baseline; justify-content: space-between;
    margin-bottom: 10px;
  }
  .recent-head h2 { margin: 0; font-size: 13px; font-weight: 600; opacity: .85; }
  .recent-head button {
    border: none; background: none; color: var(--vscode-textLink-foreground, #3794ff);
    cursor: pointer; font: inherit; font-size: 12px; padding: 0;
  }
  .recent-list { display: flex; flex-direction: column; gap: 2px; }
  .recent-item {
    display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: center;
    padding: 10px 12px; border-radius: 6px; cursor: pointer;
  }
  .recent-item:hover { background: var(--vscode-list-hoverBackground, #2a2d2e); }
  .recent-item .name { font-size: 13px; font-weight: 600; }
  .recent-item .path { font-size: 11px; opacity: .55; text-align: right; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 360px; }
  .empty { opacity: .55; font-size: 12px; padding: 8px 12px; }
  .footer {
    margin-top: 22px; display: flex; justify-content: center; gap: 16px; flex-wrap: wrap;
    font-size: 12px; opacity: .7;
  }
  .footer button {
    border: none; background: none; color: var(--vscode-textLink-foreground, #3794ff);
    cursor: pointer; font: inherit; padding: 0;
  }
  .err { color: var(--vscode-errorForeground, #f85149); text-align: center; margin-top: 12px; font-size: 12px; }
  @media (max-width: 720px) {
    .cards { grid-template-columns: 1fr; }
  }
</style>
</head>
<body>
  <div class="wrap">
    <div class="brand">
      <img src="${logoUri}" alt="EditCore" />
      <h1>EDITCORE</h1>
      <p>IDE con Claude y OpenAI integrados</p>
    </div>

    <div class="cards">
      <button class="card" id="openFolder">
        <div class="icon">📁</div>
        <div class="title">Abrir proyecto</div>
      </button>
      <button class="card" id="cloneRepo">
        <div class="icon">⬇</div>
        <div class="title">Clonar repositorio</div>
      </button>
      <button class="card" id="connectSsh">
        <div class="icon">⌘</div>
        <div class="title">Conectar por SSH</div>
      </button>
    </div>

    <div class="recent-head">
      <h2>Proyectos recientes</h2>
      <button id="openAllRecent">Ver todos</button>
    </div>
    <div class="recent-list" id="recentList">
      <div class="empty">Aún no hay proyectos recientes.</div>
    </div>

    <div class="footer">
      <button id="configureApis">Configurar API Keys</button>
      <span>Ctrl+Alt+I · Chat</span>
      <span>Ctrl+Alt+R · Recargar</span>
    </div>
    <p class="err" id="err"></p>
  </div>

<script>
  const vscode = acquireVsCodeApi();
  const err = document.getElementById('err');
  document.getElementById('openFolder').onclick = () => { err.textContent = ''; vscode.postMessage({ type: 'openFolder' }); };
  document.getElementById('cloneRepo').onclick = () => { err.textContent = ''; vscode.postMessage({ type: 'cloneRepo' }); };
  document.getElementById('connectSsh').onclick = () => { err.textContent = ''; vscode.postMessage({ type: 'connectSsh' }); };
  document.getElementById('openAllRecent').onclick = () => vscode.postMessage({ type: 'openAllRecent' });
  document.getElementById('configureApis').onclick = () => vscode.postMessage({ type: 'configureApis' });

  window.addEventListener('message', (e) => {
    const msg = e.data;
    if (msg.type === 'error') { err.textContent = msg.text; return; }
    if (msg.type !== 'state') return;
    err.textContent = '';
    const list = document.getElementById('recentList');
    list.innerHTML = '';
    if (!msg.recents || !msg.recents.length) {
      list.innerHTML = '<div class="empty">Aún no hay proyectos recientes. Abre una carpeta o clona un repo.</div>';
      return;
    }
    for (const item of msg.recents) {
      const row = document.createElement('button');
      row.className = 'recent-item';
      row.innerHTML = '<span class="name"></span><span class="path"></span>';
      row.querySelector('.name').textContent = item.name;
      row.querySelector('.path').textContent = item.parent;
      row.onclick = () => vscode.postMessage({ type: 'openRecent', path: item.path });
      list.appendChild(row);
    }
  });
  vscode.postMessage({ type: 'refresh' });
</script>
</body>
</html>`;
}
