import * as vscode from "vscode";
import { ApiKeyService } from "./apiKeyService";

export class EditCoreHomeViewProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;

  constructor(private readonly apiKeyService: ApiKeyService) {
    apiKeyService.onDidChange(() => this.refresh());
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this.getHtml();

    webviewView.webview.onDidReceiveMessage(async (msg) => {
      if (msg.type === "openApi") {
        await vscode.commands.executeCommand("editcore.openAccountPanel");
      } else if (msg.type === "runDiagnostic") {
        await vscode.commands.executeCommand("editcore.selfDiagnostic");
      } else if (msg.type === "reloadWindow") {
        await vscode.commands.executeCommand("editcore.reloadWindow");
      }
    });

    void this.refresh();
  }

  private async refresh(): Promise<void> {
    if (!this.view) {
      return;
    }
    const snapshot = await this.apiKeyService.getSnapshot();
    this.view.webview.postMessage({
      type: "state",
      hasApiKey: snapshot.hasApiKey || snapshot.hasOpenAiKey,
      hasAnthropic: snapshot.hasApiKey,
      hasOpenAi: snapshot.hasOpenAiKey,
      apiKeyHint: snapshot.apiKeyHint,
      openAiKeyHint: snapshot.openAiKeyHint,
      fallbackEnabled: snapshot.fallbackEnabled,
    });
  }

  private getHtml(): string {
    return /* html */ `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; }
  body {
    font-family: var(--vscode-font-family);
    background: var(--vscode-sideBar-background);
    color: var(--vscode-foreground);
    margin: 0; padding: 12px;
    font-size: 13px; line-height: 1.45;
  }
  h2 { font-size: 14px; margin: 0 0 4px; font-weight: 600; }
  .sub { opacity: 0.75; font-size: 12px; margin-bottom: 16px; }
  .actions { display: flex; flex-direction: column; gap: 10px; }
  .action-btn {
    display: flex; align-items: center; gap: 10px;
    width: 100%; padding: 14px 16px; border-radius: 8px;
    border: none; cursor: pointer; font: inherit; font-size: 14px; font-weight: 600;
    text-align: left; transition: background .15s;
  }
  .action-btn .icon { font-size: 18px; opacity: .9; flex-shrink: 0; }
  .action-btn .label { flex: 1; }
  .action-btn .chevron { opacity: .5; font-size: 12px; }
  .action-primary {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
  }
  .action-primary:hover { background: var(--vscode-button-hoverBackground); }
  .action-secondary {
    background: var(--vscode-editor-background);
    color: var(--vscode-foreground);
    border: 1px solid var(--vscode-panel-border, rgba(128,128,128,.35));
  }
  .action-secondary:hover { background: var(--vscode-toolbar-hoverBackground); }
  .status {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 600;
    margin-bottom: 14px;
  }
  .status.ok { background: rgba(46,160,67,.18); color: #3fb950; }
  .status.bad { background: rgba(248,81,73,.15); color: #f85149; }
  .hint { font-size: 11px; opacity: .65; margin: -4px 0 0 4px; }
  .reload-bar {
    display: flex; justify-content: flex-end; margin-bottom: 10px;
  }
  .reload-btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 5px 10px; border-radius: 4px; font-size: 12px; font-weight: 600;
    border: 1px solid var(--vscode-panel-border, rgba(128,128,128,.35));
    background: var(--vscode-editor-background); color: var(--vscode-foreground);
    cursor: pointer;
  }
  .reload-btn:hover { background: var(--vscode-toolbar-hoverBackground); }
</style>
</head>
<body>
  <div class="reload-bar">
    <button class="reload-btn" id="reloadWindow" title="Aplicar cambios sin cerrar EditCore">↻ Recargar cambios</button>
  </div>

  <h2>EditCore</h2>
  <p class="sub">Accesos rápidos a configuración y diagnóstico del IDE.</p>

  <div id="statusBadge" class="status bad">Sin API Key</div>

  <div class="actions">
    <button class="action-btn action-primary" id="openApi">
      <span class="icon">🔑</span>
      <span class="label">Configurar APIs</span>
      <span class="chevron">›</span>
    </button>
    <p class="hint">Anthropic (Claude), Voyage y más</p>

    <button class="action-btn action-secondary" id="runDiagnostic">
      <span class="icon">🩺</span>
      <span class="label">Autodiagnóstico</span>
      <span class="chevron">›</span>
    </button>
    <p class="hint">Revisa el IDE, extensiones y tu proyecto</p>
  </div>

<script>
  const vscode = acquireVsCodeApi();
  document.getElementById('openApi').onclick = () => vscode.postMessage({ type: 'openApi' });
  document.getElementById('runDiagnostic').onclick = () => vscode.postMessage({ type: 'runDiagnostic' });
  document.getElementById('reloadWindow').onclick = () => vscode.postMessage({ type: 'reloadWindow' });

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (msg.type !== 'state') return;
    const badge = document.getElementById('statusBadge');
    badge.className = 'status ' + (msg.hasApiKey ? 'ok' : 'bad');
    if (msg.hasAnthropic && msg.hasOpenAi) {
      badge.textContent = 'Claude + OpenAI · ' + (msg.apiKeyHint || '');
    } else if (msg.hasOpenAi) {
      badge.textContent = 'Solo OpenAI · ' + (msg.openAiKeyHint || '');
    } else if (msg.hasAnthropic) {
      badge.textContent = 'Claude activo · ' + (msg.apiKeyHint || '');
    } else {
      badge.textContent = 'Sin API Key — configúrala abajo';
    }
  });
</script>
</body>
</html>`;
  }
}
