import * as vscode from "vscode";
import { ApiKeyService } from "./apiKeyService";
import { CLAUDE_MODELS, OPENAI_MODELS, getModelLabel, getOpenAiModelLabel } from "./models";

export class ClaudeConfigViewProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly apiKeyService: ApiKeyService
  ) {
    context.subscriptions.push(
      apiKeyService.onDidChange(() => this.refresh()),
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("editcore")) {
          this.refresh();
        }
      })
    );
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this.getHtml();

    webviewView.webview.onDidReceiveMessage(async (msg) => {
      try {
        if (msg.type === "saveKey") {
          await this.apiKeyService.saveApiKey(msg.key);
          vscode.window.showInformationMessage("EditCore: API Key de Anthropic guardada.");
          await this.refresh();
        } else if (msg.type === "clearKey") {
          await this.apiKeyService.clearApiKey();
          vscode.window.showInformationMessage("EditCore: API Key de Anthropic eliminada.");
          await this.refresh();
        } else if (msg.type === "saveOpenAiKey") {
          await this.apiKeyService.saveOpenAiKey(msg.key);
          vscode.window.showInformationMessage("EditCore: API Key de OpenAI guardada.");
          await this.refresh();
        } else if (msg.type === "clearOpenAiKey") {
          await this.apiKeyService.clearOpenAiKey();
          vscode.window.showInformationMessage("EditCore: API Key de OpenAI eliminada.");
          await this.refresh();
        } else if (msg.type === "saveOpenAiModel") {
          await vscode.workspace
            .getConfiguration("editcore")
            .update("openai.model", msg.model, vscode.ConfigurationTarget.Global);
          await this.refresh();
        } else if (msg.type === "saveFallback") {
          await vscode.workspace
            .getConfiguration("editcore")
            .update("fallback.enabled", Boolean(msg.enabled), vscode.ConfigurationTarget.Global);
          await this.refresh();
        } else if (msg.type === "openOpenAiConsole") {
          void vscode.env.openExternal(
            vscode.Uri.parse("https://platform.openai.com/api-keys")
          );
        } else if (msg.type === "saveModel") {
          await vscode.workspace
            .getConfiguration("editcore")
            .update("model", msg.model, vscode.ConfigurationTarget.Global);
          await this.refresh();
        } else if (msg.type === "openConsole") {
          void vscode.env.openExternal(
            vscode.Uri.parse("https://console.anthropic.com/settings/keys")
          );
        } else if (msg.type === "openChat") {
          await vscode.commands.executeCommand("editcore.openChat");
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        this.view?.webview.postMessage({ type: "error", text: message });
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
      snapshot,
      models: CLAUDE_MODELS,
      openAiModels: OPENAI_MODELS,
      modelLabel: getModelLabel(snapshot.model),
      openAiModelLabel: getOpenAiModelLabel(snapshot.openAiModel),
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
  .sub { opacity: 0.75; font-size: 12px; margin-bottom: 14px; }
  section {
    border: 1px solid var(--vscode-panel-border, rgba(128,128,128,.35));
    border-radius: 8px; padding: 12px; margin-bottom: 12px;
    background: var(--vscode-editor-background);
  }
  label { display: block; font-size: 11px; font-weight: 600; margin: 10px 0 4px; opacity: .85; text-transform: uppercase; letter-spacing: .03em; }
  input, select {
    width: 100%; padding: 7px 8px; border-radius: 4px;
    border: 1px solid var(--vscode-input-border, transparent);
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground); font: inherit;
  }
  .row { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
  button {
    border: none; border-radius: 4px; padding: 7px 12px; cursor: pointer; font: inherit;
    background: var(--vscode-button-background); color: var(--vscode-button-foreground);
  }
  button.secondary {
    background: transparent; color: var(--vscode-foreground);
    border: 1px solid var(--vscode-panel-border, rgba(128,128,128,.35));
  }
  button:hover { background: var(--vscode-button-hoverBackground); }
  button.secondary:hover { background: var(--vscode-toolbar-hoverBackground); }
  .status {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 4px 8px; border-radius: 999px; font-size: 12px; font-weight: 600;
  }
  .status.ok { background: rgba(46,160,67,.18); color: #3fb950; }
  .status.bad { background: rgba(248,81,73,.15); color: #f85149; }
  .hint { font-size: 11px; opacity: .7; margin-top: 8px; }
  .error { color: var(--vscode-errorForeground); margin-top: 8px; font-size: 12px; }
  .skills { font-size: 12px; opacity: .85; margin: 0; padding-left: 18px; }
  .skills li { margin: 4px 0; }
</style>
</head>
<body>
  <h2>Cuenta &amp; API</h2>
  <p class="sub">Guardá tu key de Anthropic (Claude). OpenAI es opcional como respaldo. El chat y el agente usan estas APIs con habilidades integradas.</p>

  <section>
    <div id="statusBadge" class="status bad">Sin API Key</div>
    <p class="hint" id="keyHint"></p>

    <label for="apiKey">Anthropic API Key</label>
    <input id="apiKey" type="password" placeholder="sk-ant-..." autocomplete="off" />

    <div class="row">
      <button id="saveKey">Guardar</button>
      <button class="secondary" id="clearKey">Eliminar</button>
      <button class="secondary" id="openConsole">Obtener key</button>
    </div>
    <div id="error" class="error"></div>
  </section>

  <section>
    <div id="openAiStatusBadge" class="status bad">OpenAI sin configurar</div>
    <p class="hint" id="openAiKeyHint"></p>

    <label for="openAiKey">OpenAI API Key (opcional)</label>
    <input id="openAiKey" type="password" placeholder="sk-..." autocomplete="off" />

    <div class="row">
      <button id="saveOpenAiKey">Guardar</button>
      <button class="secondary" id="clearOpenAiKey">Eliminar</button>
      <button class="secondary" id="openOpenAiConsole">Obtener key</button>
    </div>

    <label for="openAiModel">Modelo OpenAI</label>
    <select id="openAiModel"></select>
    <p class="hint" id="openAiModelDesc"></p>
    <div class="row">
      <button id="saveOpenAiModel">Aplicar modelo OpenAI</button>
    </div>

    <label style="display:flex;align-items:center;gap:8px;margin-top:12px;text-transform:none;font-size:13px;">
      <input type="checkbox" id="fallbackEnabled" style="width:auto;" />
      Respaldo automático: si Claude falla, usar OpenAI
    </label>
    <div id="openAiError" class="error"></div>
  </section>

  <section>
    <label for="model">Modelo Claude</label>
    <select id="model"></select>
    <p class="hint" id="modelDesc"></p>
    <div class="row">
      <button id="saveModel">Aplicar modelo</button>
      <button class="secondary" id="openChat">Abrir chat</button>
    </div>
  </section>

  <section>
    <p class="hint" style="margin-top:0;"><strong>Uso e costos estimados de IA</strong></p>
    <table style="width:100%; font-size:12px; border-collapse:collapse;">
      <tr><td style="opacity:.7;">Sesión actual</td><td id="sessTokens" style="text-align:right;"></td><td id="sessCost" style="text-align:right; font-weight:600;"></td></tr>
      <tr><td style="opacity:.7;">Total histórico (esta instalación)</td><td id="totalTokens" style="text-align:right;"></td><td id="totalCost" style="text-align:right; font-weight:600;"></td></tr>
    </table>
    <p class="hint" id="toolCallsHint" style="margin-top:8px;"></p>
    <p class="hint" style="margin-top:6px; opacity:.6;">Estimado a partir de tokens reportados por la API y precios públicos por modelo. Solo visible localmente — EditCore no envía estos datos a ningún servidor.</p>
  </section>

  <section>
    <p class="hint" style="margin-top:0;"><strong>Habilidades del agente</strong> (sin instalar nada):</p>
    <ul class="skills">
      <li><code>@architect</code> — Arquitectura y ADRs</li>
      <li><code>@gps</code> — Plataformas GPS y flotas</li>
      <li><code>@saas</code> — Proyectos SaaS</li>
      <li><code>@founder</code> — MVP y negocio</li>
      <li><code>@security</code> — Seguridad OWASP</li>
      <li><code>@cto</code> — Compliance y escalabilidad</li>
    </ul>
  </section>

<script>
  const vscode = acquireVsCodeApi();
  const apiKey = document.getElementById('apiKey');
  const model = document.getElementById('model');
  const modelDesc = document.getElementById('modelDesc');
  const statusBadge = document.getElementById('statusBadge');
  const keyHint = document.getElementById('keyHint');
  const errorEl = document.getElementById('error');
  const openAiErrorEl = document.getElementById('openAiError');
  const openAiModel = document.getElementById('openAiModel');
  const openAiModelDesc = document.getElementById('openAiModelDesc');

  document.getElementById('saveKey').onclick = () => {
    errorEl.textContent = '';
    vscode.postMessage({ type: 'saveKey', key: apiKey.value });
  };
  document.getElementById('clearKey').onclick = () => vscode.postMessage({ type: 'clearKey' });
  document.getElementById('saveOpenAiKey').onclick = () => {
    openAiErrorEl.textContent = '';
    vscode.postMessage({ type: 'saveOpenAiKey', key: document.getElementById('openAiKey').value });
  };
  document.getElementById('clearOpenAiKey').onclick = () => vscode.postMessage({ type: 'clearOpenAiKey' });
  document.getElementById('saveOpenAiModel').onclick = () => vscode.postMessage({ type: 'saveOpenAiModel', model: openAiModel.value });
  document.getElementById('openOpenAiConsole').onclick = () => vscode.postMessage({ type: 'openOpenAiConsole' });
  document.getElementById('fallbackEnabled').onchange = (e) => {
    vscode.postMessage({ type: 'saveFallback', enabled: e.target.checked });
  };
  document.getElementById('saveModel').onclick = () => vscode.postMessage({ type: 'saveModel', model: model.value });
  document.getElementById('openConsole').onclick = () => vscode.postMessage({ type: 'openConsole' });
  document.getElementById('openChat').onclick = () => vscode.postMessage({ type: 'openChat' });

  model.onchange = () => {
    const opt = model.options[model.selectedIndex];
    modelDesc.textContent = opt?.dataset?.desc || '';
  };
  openAiModel.onchange = () => {
    const opt = openAiModel.options[openAiModel.selectedIndex];
    openAiModelDesc.textContent = opt?.dataset?.desc || '';
  };

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (msg.type === 'error') {
      errorEl.textContent = msg.text;
      return;
    }
    if (msg.type !== 'state') return;
    errorEl.textContent = '';
    openAiErrorEl.textContent = '';
    const s = msg.snapshot;
    const hasAny = s.hasApiKey || s.hasOpenAiKey;
    statusBadge.className = 'status ' + (s.hasApiKey ? 'ok' : 'bad');
    statusBadge.textContent = s.hasApiKey ? 'Claude activo' : 'Claude sin configurar';
    keyHint.textContent = s.hasApiKey
      ? 'Key: ' + s.apiKeyHint
      : 'Pegá tu key de Anthropic y pulsá Guardar.';

    const openAiStatusBadge = document.getElementById('openAiStatusBadge');
    const openAiKeyHint = document.getElementById('openAiKeyHint');
    openAiStatusBadge.className = 'status ' + (s.hasOpenAiKey ? 'ok' : 'bad');
    openAiStatusBadge.textContent = s.hasOpenAiKey ? 'OpenAI activa' : 'OpenAI opcional';
    openAiKeyHint.textContent = s.hasOpenAiKey
      ? 'Key: ' + s.openAiKeyHint + (s.fallbackEnabled ? ' · respaldo ON' : '')
      : 'Opcional — respaldo si Claude no responde.';
    document.getElementById('fallbackEnabled').checked = s.fallbackEnabled !== false;

    model.innerHTML = '';
    for (const m of msg.models) {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.label;
      opt.dataset.desc = m.description;
      if (m.id === s.model) opt.selected = true;
      model.appendChild(opt);
    }
    modelDesc.textContent = msg.models.find(m => m.id === s.model)?.description || '';

    openAiModel.innerHTML = '';
    for (const m of msg.openAiModels || []) {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.label;
      opt.dataset.desc = m.description;
      if (m.id === s.openAiModel) opt.selected = true;
      openAiModel.appendChild(opt);
    }
    openAiModelDesc.textContent = (msg.openAiModels || []).find(m => m.id === s.openAiModel)?.description || '';

    document.getElementById('sessTokens').textContent =
      '↑' + (s.sessionInputTokens || 0).toLocaleString() + ' ↓' + (s.sessionOutputTokens || 0).toLocaleString() + ' tok';
    document.getElementById('sessCost').textContent = '$' + (s.sessionEstimatedCostUsd || 0).toFixed(4);
    document.getElementById('totalTokens').textContent =
      '↑' + (s.inputTokens || 0).toLocaleString() + ' ↓' + (s.outputTokens || 0).toLocaleString() + ' tok · ' + (s.requestCount || 0) + ' req';
    document.getElementById('totalCost').textContent = '$' + (s.estimatedCostUsd || 0).toFixed(4);
    const toolEntries = Object.entries(s.toolCalls || {}).sort((a, b) => b[1] - a[1]).slice(0, 6);
    document.getElementById('toolCallsHint').textContent = toolEntries.length
      ? 'Tools más usadas: ' + toolEntries.map(([name, count]) => name + ' (' + count + ')').join(', ')
      : 'Sin uso del Agent Mode registrado todavía.';
  });
</script>
</body>
</html>`;
  }
}
