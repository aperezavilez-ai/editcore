import * as vscode from "vscode";
import {
  clearAnthropicApiKey,
  clearOpenAiApiKey,
  getApiKeyStatus,
  saveAnthropicApiKey,
  saveOpenAiApiKey,
} from "./claudeApiKeyBridge";

export class ApiKeysPanelProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this.getHtml();

    webviewView.webview.onDidReceiveMessage(async (msg) => {
      try {
        if (msg.type === "refresh") {
          await this.pushState();
        } else if (msg.type === "saveAnthropic") {
          const key = String(msg.key || "").trim();
          if (!key.startsWith("sk-")) {
            throw new Error("La key de Anthropic debe empezar con sk-");
          }
          await saveAnthropicApiKey(key);
          await this.pushState();
        } else if (msg.type === "saveOpenAi") {
          const key = String(msg.key || "").trim();
          if (!key.startsWith("sk-")) {
            throw new Error("La key de OpenAI debe empezar con sk-");
          }
          await saveOpenAiApiKey(key);
          await this.pushState();
        } else if (msg.type === "clearAnthropic") {
          await clearAnthropicApiKey();
          await this.pushState();
        } else if (msg.type === "clearOpenAi") {
          await clearOpenAiApiKey();
          await this.pushState();
        } else if (msg.type === "openClaudePanel") {
          await vscode.commands.executeCommand("workbench.view.extension.editcore-sidebar");
          await vscode.commands.executeCommand("editcore.accountView.focus");
        }
      } catch (e: unknown) {
        const text = e instanceof Error ? e.message : String(e);
        this.view?.webview.postMessage({ type: "error", text });
      }
    });

    void this.pushState();
  }

  private async pushState(): Promise<void> {
    try {
      const status = await getApiKeyStatus();
      this.view?.webview.postMessage({
        type: "state",
        anthropicHint: status.anthropicHint,
        openAiHint: status.openAiHint,
        hasAnthropic: status.hasAnthropic,
        hasOpenAi: status.hasOpenAi,
      });
    } catch (e: unknown) {
      const text = e instanceof Error ? e.message : String(e);
      this.view?.webview.postMessage({
        type: "state",
        anthropicHint: "Sin configurar",
        openAiHint: "Sin configurar",
        hasAnthropic: false,
        hasOpenAi: false,
      });
      this.view?.webview.postMessage({
        type: "error",
        text: `No se pudo leer el estado de API keys: ${text}`,
      });
    }
  }

  private getHtml(): string {
    return /* html */ `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: var(--vscode-font-family); margin: 0; padding: 12px; color: var(--vscode-foreground); background: var(--vscode-sideBar-background); font-size: 13px; }
  h2 { font-size: 14px; margin: 0 0 8px; }
  .sub { opacity: .75; font-size: 12px; margin-bottom: 14px; line-height: 1.4; }
  section { border: 1px solid var(--vscode-panel-border, rgba(128,128,128,.35)); border-radius: 8px; padding: 12px; margin-bottom: 12px; background: var(--vscode-editor-background); }
  label { display: block; font-size: 11px; font-weight: 600; margin: 8px 0 4px; opacity: .85; text-transform: uppercase; }
  input { width: 100%; padding: 8px; border-radius: 4px; border: 1px solid var(--vscode-input-border, transparent); background: var(--vscode-input-background); color: var(--vscode-input-foreground); font: inherit; box-sizing: border-box; }
  .row { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
  button { border: none; border-radius: 4px; padding: 8px 12px; cursor: pointer; font: inherit; background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
  button.secondary { background: transparent; border: 1px solid var(--vscode-panel-border, rgba(128,128,128,.35)); color: var(--vscode-foreground); }
  button:hover { background: var(--vscode-button-hoverBackground); }
  .hint { font-size: 11px; opacity: .7; margin-top: 6px; }
  .ok { color: #3fb950; font-weight: 600; font-size: 12px; }
  .bad { color: #f85149; font-weight: 600; font-size: 12px; }
  .err { color: var(--vscode-errorForeground); font-size: 12px; margin-top: 8px; white-space: pre-wrap; }
</style>
</head>
<body>
  <h2>API Keys</h2>
  <p class="sub">Pega aquí tus keys. Se guardan cifradas en SecretStorage (EditCore Claude). <strong>No instales nada del marketplace.</strong></p>

  <section>
    <div id="anthropicStatus" class="bad">Sin Claude</div>
    <label>Claude (Anthropic) — sk-ant-...</label>
    <input id="anthropicKey" type="password" placeholder="sk-ant-..." autocomplete="off" />
    <div class="row">
      <button id="saveAnthropic">Guardar Claude</button>
      <button class="secondary" id="clearAnthropic">Eliminar</button>
    </div>
    <p class="hint" id="anthropicHint"></p>
  </section>

  <section>
    <div id="openaiStatus" class="bad">Sin OpenAI</div>
    <label>OpenAI (respaldo) — sk-...</label>
    <input id="openaiKey" type="password" placeholder="sk-..." autocomplete="off" />
    <div class="row">
      <button id="saveOpenAi">Guardar OpenAI</button>
      <button class="secondary" id="clearOpenAi">Eliminar</button>
    </div>
    <p class="hint" id="openaiHint"></p>
  </section>

  <p class="hint">Después de guardar: <strong>Ctrl+Alt+R</strong> para recargar. Chat: <strong>Ctrl+Alt+I</strong></p>
  <p class="err" id="err"></p>

<script>
  const vscode = acquireVsCodeApi();
  const err = document.getElementById('err');
  document.getElementById('saveAnthropic').onclick = () => {
    err.textContent = '';
    vscode.postMessage({ type: 'saveAnthropic', key: document.getElementById('anthropicKey').value });
  };
  document.getElementById('saveOpenAi').onclick = () => {
    err.textContent = '';
    vscode.postMessage({ type: 'saveOpenAi', key: document.getElementById('openaiKey').value });
  };
  document.getElementById('clearAnthropic').onclick = () => vscode.postMessage({ type: 'clearAnthropic' });
  document.getElementById('clearOpenAi').onclick = () => vscode.postMessage({ type: 'clearOpenAi' });
  window.addEventListener('message', (e) => {
    const msg = e.data;
    if (msg.type === 'error') { err.textContent = msg.text; return; }
    if (msg.type !== 'state') return;
    err.textContent = '';
    const aSt = document.getElementById('anthropicStatus');
    const oSt = document.getElementById('openaiStatus');
    aSt.className = msg.hasAnthropic ? 'ok' : 'bad';
    aSt.textContent = msg.hasAnthropic ? 'Claude activa · ' + msg.anthropicHint : 'Sin Claude';
    oSt.className = msg.hasOpenAi ? 'ok' : 'bad';
    oSt.textContent = msg.hasOpenAi ? 'OpenAI activa · ' + msg.openaiHint : 'Sin OpenAI (opcional)';
    document.getElementById('anthropicHint').textContent = msg.hasAnthropic ? 'Key: ' + msg.anthropicHint : 'Pega tu key de console.anthropic.com';
    document.getElementById('openaiHint').textContent = msg.hasOpenAi ? 'Key: ' + msg.openaiHint : 'Opcional — key de platform.openai.com';
  });
  vscode.postMessage({ type: 'refresh' });
</script>
</body>
</html>`;
  }
}
