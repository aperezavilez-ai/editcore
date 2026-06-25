import * as vscode from "vscode";
import {
  keyHint,
  readSharedKeys,
  validateAnthropicKey,
  validateOpenAiKey,
  writeSharedKeys,
} from "./sharedApiKeys";
import { ApiKeyService } from "../../editcore-claude/src/apiKeyService";

export class ApiKeysPanelProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly apiKeyService?: ApiKeyService
  ) {}

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
            throw new Error("La key de GPTPRO4ALL debe empezar con sk-");
          }
          if (this.apiKeyService) {
            await this.apiKeyService.saveApiKey(key);
          } else {
            await writeSharedKeys({ anthropic: key });
            await this.context.secrets.store("anthropicApiKey", key);
            await validateAnthropicKey(key).catch(() => void 0);
          }
          vscode.window.showInformationMessage("EditCore: API Key Claude GPTPRO4ALL guardada.");
          await this.pushState();
        } else if (msg.type === "saveOpenAi") {
          const key = String(msg.key || "").trim();
          if (!key.startsWith("sk-")) {
            throw new Error("La key de OpenAI debe empezar con sk-");
          }
          if (this.apiKeyService) {
            await this.apiKeyService.saveOpenAiKey(key);
          } else {
            await writeSharedKeys({ openai: key });
            await this.context.secrets.store("openaiApiKey", key);
            await validateOpenAiKey(key).catch(() => void 0);
          }
          vscode.window.showInformationMessage("EditCore: API Key Codex GPTPRO4ALL guardada.");
          await this.pushState();
        } else if (msg.type === "clearAnthropic") {
          await writeSharedKeys({ anthropic: undefined });
          await this.context.secrets.delete("anthropicApiKey");
          await this.pushState();
        } else if (msg.type === "clearOpenAi") {
          await writeSharedKeys({ openai: undefined });
          await this.context.secrets.delete("openaiApiKey");
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
    const shared = readSharedKeys();
    const anthropic =
      shared.anthropic || (await this.context.secrets.get("anthropicApiKey")) || "";
    const openai = shared.openai || (await this.context.secrets.get("openaiApiKey")) || "";
    this.view?.webview.postMessage({
      type: "state",
      anthropicHint: keyHint(anthropic),
      openaiHint: keyHint(openai),
      hasAnthropic: Boolean(anthropic),
      hasOpenAi: Boolean(openai),
    });
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
  <p class="sub">Pega aquí tus keys. <strong>No instales nada del marketplace.</strong> Este panel funciona aunque Claude esté desactivado.</p>

  <section>
    <div id="anthropicStatus" class="bad">Sin Claude GPTPRO4ALL</div>
    <label>GPTPRO4ALL Claude — sk-...</label>
    <input id="anthropicKey" type="password" placeholder="sk-..." autocomplete="off" />
    <div class="row">
      <button id="saveAnthropic">Guardar Claude</button>
      <button class="secondary" id="clearAnthropic">Eliminar</button>
    </div>
    <p class="hint" id="anthropicHint"></p>
  </section>

  <section>
    <div id="openaiStatus" class="bad">Sin Codex GPTPRO4ALL</div>
    <label>GPTPRO4ALL Codex (respaldo) — sk-...</label>
    <input id="openaiKey" type="password" placeholder="sk-..." autocomplete="off" />
    <div class="row">
      <button id="saveOpenAi">Guardar Codex</button>
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
    aSt.textContent = msg.hasAnthropic ? 'Claude GPTPRO4ALL activa · ' + msg.anthropicHint : 'Sin Claude GPTPRO4ALL';
    oSt.className = msg.hasOpenAi ? 'ok' : 'bad';
    oSt.textContent = msg.hasOpenAi ? 'Codex GPTPRO4ALL activa · ' + msg.openaiHint : 'Sin Codex GPTPRO4ALL (opcional)';
    document.getElementById('anthropicHint').textContent = msg.hasAnthropic ? 'Key: ' + msg.anthropicHint : 'Usa tu key GPTPRO4ALL Claude';
    document.getElementById('openaiHint').textContent = msg.hasOpenAi ? 'Key: ' + msg.openaiHint : 'Opcional — usa tu key GPTPRO4ALL Codex';
  });
  vscode.postMessage({ type: 'refresh' });
</script>
</body>
</html>`;
  }
}
