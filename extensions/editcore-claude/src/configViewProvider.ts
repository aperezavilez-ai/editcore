import * as vscode from "vscode";
import { ApiKeyService } from "./apiKeyService";
import { CLAUDE_MODELS, OPENAI_MODELS, getModelLabel, getOpenAiModelLabel } from "./models";
import { getEffectivePlan, type EditCorePlan } from "./enterprise/orgConfig";
import {
  getVoyageKeyHint,
  saveVoyageApiKey,
  clearVoyageApiKey,
} from "./rag/voyageService";

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
          vscode.window.showInformationMessage("EditCore: API Key guardada y validada.");
          await this.refresh();
        } else if (msg.type === "clearKey") {
          await this.apiKeyService.clearApiKey();
          vscode.window.showInformationMessage("EditCore: API Key eliminada.");
          await this.refresh();
        } else if (msg.type === "saveOpenAiKey") {
          await this.apiKeyService.saveOpenAiKey(msg.key);
          vscode.window.showInformationMessage("EditCore: OpenAI API Key guardada y validada.");
          await this.refresh();
        } else if (msg.type === "clearOpenAiKey") {
          await this.apiKeyService.clearOpenAiKey();
          vscode.window.showInformationMessage("EditCore: OpenAI API Key eliminada.");
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
        } else if (msg.type === "saveMaxTokens") {
          await vscode.workspace
            .getConfiguration("editcore")
            .update("maxTokens", Number(msg.maxTokens), vscode.ConfigurationTarget.Global);
          await this.refresh();
        } else if (msg.type === "resetSession") {
          this.apiKeyService.resetSessionUsage();
          await this.refresh();
        } else if (msg.type === "openBilling") {
          void vscode.env.openExternal(
            vscode.Uri.parse("https://console.anthropic.com/settings/billing")
          );
        } else if (msg.type === "openConsole") {
          void vscode.env.openExternal(
            vscode.Uri.parse("https://console.anthropic.com/settings/keys")
          );
        } else if (msg.type === "openChat") {
          await vscode.commands.executeCommand("editcore.openChat");
        } else if (msg.type === "savePlan") {
          await vscode.workspace
            .getConfiguration("editcore")
            .update("plan", msg.plan as EditCorePlan, vscode.ConfigurationTarget.Workspace);
          await this.refresh();
        } else if (msg.type === "openMarketplace") {
          await vscode.commands.executeCommand("editcore.openMarketplace");
        } else if (msg.type === "showSessions") {
          await vscode.commands.executeCommand("editcore.showSessions");
        } else if (msg.type === "showAudit") {
          await vscode.commands.executeCommand("editcore.showAuditLog");
        } else if (msg.type === "initWorkspace") {
          await vscode.commands.executeCommand("editcore.initWorkspace");
        } else if (msg.type === "saveVoyageKey") {
          await saveVoyageApiKey(msg.key);
          vscode.window.showInformationMessage("EditCore: Voyage API Key guardada (RAG mejorado).");
          await this.refresh();
        } else if (msg.type === "clearVoyageKey") {
          await clearVoyageApiKey();
          vscode.window.showInformationMessage("EditCore: Voyage API Key eliminada.");
          await this.refresh();
        } else if (msg.type === "openVoyage") {
          void vscode.env.openExternal(vscode.Uri.parse("https://dash.voyageai.com/"));
        } else if (msg.type === "runDiagnostic") {
          await vscode.commands.executeCommand("editcore.selfDiagnostic");
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
    const maxTokens = vscode.workspace.getConfiguration("editcore").get<number>("maxTokens", 4096);
    const plan = await getEffectivePlan();
    const voyageHint = await getVoyageKeyHint();
    const useEmbeddings = vscode.workspace.getConfiguration("editcore").get<boolean>("rag.useEmbeddings", true);
    this.view.webview.postMessage({
      type: "state",
      snapshot,
      models: CLAUDE_MODELS,
      openAiModels: OPENAI_MODELS,
      maxTokens,
      modelLabel: getModelLabel(snapshot.model),
      openAiModelLabel: getOpenAiModelLabel(snapshot.openAiModel),
      plan,
      voyageHint,
      useEmbeddings,
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
  .metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; }
  .metric {
    padding: 8px; border-radius: 6px;
    background: var(--vscode-sideBar-background);
    border: 1px solid var(--vscode-panel-border, rgba(128,128,128,.2));
  }
  .metric .n { font-size: 18px; font-weight: 700; }
  .metric .l { font-size: 11px; opacity: .75; }
  .hint { font-size: 11px; opacity: .7; margin-top: 8px; }
  .error { color: var(--vscode-errorForeground); margin-top: 8px; font-size: 12px; }
  a { color: var(--vscode-textLink-foreground); cursor: pointer; }
  .action-btn {
    display: flex; align-items: center; gap: 8px;
    width: 100%; padding: 12px 14px; border-radius: 6px;
    border: none; cursor: pointer; font: inherit; font-size: 13px; font-weight: 600;
    text-align: left;
  }
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
  .quick-actions { display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px; }
</style>
</head>
<body>
  <h2>Cuenta &amp; API</h2>
  <p class="sub">Configura <strong>Anthropic (Claude)</strong> y opcionalmente <strong>OpenAI</strong>. Si ambas están activas, EditCore usa Claude primero y OpenAI como respaldo automático si falla.</p>

  <div class="quick-actions">
    <button class="action-btn action-primary" id="scrollApi">🔑 Configurar APIs (Anthropic / OpenAI / Voyage)</button>
    <button class="action-btn action-secondary" id="runDiagnostic">🩺 Ejecutar autodiagnóstico</button>
  </div>

  <section id="apiSection">
    <div id="statusBadge" class="status bad">Sin API Key</div>
    <p class="hint" id="keyHint"></p>

    <label for="apiKey">Anthropic API Key</label>
    <input id="apiKey" type="password" placeholder="sk-..." autocomplete="off" />

    <div class="row">
      <button id="saveKey">Guardar y validar</button>
      <button class="secondary" id="clearKey">Eliminar key</button>
    </div>
    <div class="row">
      <button class="secondary" id="openConsole">Crear key en Anthropic</button>
      <button class="secondary" id="openBilling">Ver saldo / billing</button>
    </div>
    <div id="error" class="error"></div>
  </section>

  <section id="openAiSection">
    <div id="openAiStatusBadge" class="status bad">OpenAI sin configurar</div>
    <p class="hint" id="openAiKeyHint"></p>

    <label for="openAiKey">OpenAI API Key (respaldo)</label>
    <input id="openAiKey" type="password" placeholder="sk-..." autocomplete="off" />

    <div class="row">
      <button id="saveOpenAiKey">Guardar y validar OpenAI</button>
      <button class="secondary" id="clearOpenAiKey">Eliminar key</button>
    </div>
    <div class="row">
      <button class="secondary" id="openOpenAiConsole">Crear key en OpenAI</button>
    </div>

    <label for="openAiModel">Modelo OpenAI (respaldo)</label>
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

    <label for="maxTokens">Máximo tokens por respuesta</label>
    <input id="maxTokens" type="number" min="256" max="64000" step="256" />

    <div class="row">
      <button id="saveModel">Aplicar modelo</button>
      <button class="secondary" id="openChat">Abrir chat @claude</button>
    </div>
  </section>

  <section>
    <h2 style="font-size:13px;margin-bottom:8px;">Consumo (esta sesión)</h2>
    <div class="metrics">
      <div class="metric"><div class="n" id="sIn">0</div><div class="l">Entrada</div></div>
      <div class="metric"><div class="n" id="sOut">0</div><div class="l">Salida</div></div>
      <div class="metric"><div class="n" id="sCost">$0.00</div><div class="l">Costo est.</div></div>
      <div class="metric"><div class="n" id="sTools">0</div><div class="l">Tool calls</div></div>
    </div>
    <p class="hint" id="toolBreakdown"></p>
    <p class="hint">Total histórico: <span id="tIn">0</span> in / <span id="tOut">0</span> out · <span id="tCost">$0.00</span></p>
    <div class="row"><button class="secondary" id="resetSession">Reiniciar contador de sesión</button></div>
  </section>

  <section>
    <h2 style="font-size:13px;margin-bottom:8px;">RAG / Embeddings (opcional)</h2>
    <p class="hint" id="voyageHint">Sin Voyage key — se usa RAG local TF-IDF.</p>
    <label for="voyageKey">Voyage API Key</label>
    <input id="voyageKey" type="password" placeholder="pa-..." autocomplete="off" />
    <div class="row">
      <button id="saveVoyageKey">Guardar Voyage</button>
      <button class="secondary" id="clearVoyageKey">Eliminar</button>
      <button class="secondary" id="openVoyage">Obtener key</button>
    </div>
    <p class="hint">Con Voyage activo, <code>search_codebase</code> re-rankea con embeddings reales. Sin key funciona igual en modo local.</p>
  </section>

  <section>
    <h2 style="font-size:13px;margin-bottom:8px;">Plan &amp; plataforma</h2>
    <label for="plan">Plan EditCore</label>
    <select id="plan">
      <option value="free">Free</option>
      <option value="pro">Pro</option>
      <option value="team">Team</option>
      <option value="business">Business</option>
      <option value="enterprise">Enterprise</option>
    </select>
    <p class="hint">Controla qué ítems del Marketplace podés instalar. También en <code>.editcore/org.json</code>.</p>
    <div class="row">
      <button id="savePlan">Aplicar plan</button>
      <button class="secondary" id="openMarketplace">Marketplace</button>
    </div>
    <div class="row">
      <button class="secondary" id="showSessions">Sesiones</button>
      <button class="secondary" id="showAudit">Audit log</button>
      <button class="secondary" id="initWorkspace">Inicializar .editcore</button>
    </div>
  </section>

<script>
  const vscode = acquireVsCodeApi();
  const apiKey = document.getElementById('apiKey');
  const model = document.getElementById('model');
  const modelDesc = document.getElementById('modelDesc');
  const maxTokens = document.getElementById('maxTokens');
  const plan = document.getElementById('plan');
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
  document.getElementById('saveModel').onclick = () => {
    vscode.postMessage({ type: 'saveModel', model: model.value });
    vscode.postMessage({ type: 'saveMaxTokens', maxTokens: maxTokens.value });
  };
  document.getElementById('resetSession').onclick = () => vscode.postMessage({ type: 'resetSession' });
  document.getElementById('openConsole').onclick = () => vscode.postMessage({ type: 'openConsole' });
  document.getElementById('openBilling').onclick = () => vscode.postMessage({ type: 'openBilling' });
  document.getElementById('openChat').onclick = () => vscode.postMessage({ type: 'openChat' });
  document.getElementById('savePlan').onclick = () => vscode.postMessage({ type: 'savePlan', plan: plan.value });
  document.getElementById('openMarketplace').onclick = () => vscode.postMessage({ type: 'openMarketplace' });
  document.getElementById('showSessions').onclick = () => vscode.postMessage({ type: 'showSessions' });
  document.getElementById('showAudit').onclick = () => vscode.postMessage({ type: 'showAudit' });
  document.getElementById('initWorkspace').onclick = () => vscode.postMessage({ type: 'initWorkspace' });
  document.getElementById('saveVoyageKey').onclick = () => vscode.postMessage({ type: 'saveVoyageKey', key: document.getElementById('voyageKey').value });
  document.getElementById('clearVoyageKey').onclick = () => vscode.postMessage({ type: 'clearVoyageKey' });
  document.getElementById('openVoyage').onclick = () => vscode.postMessage({ type: 'openVoyage' });
  document.getElementById('scrollApi').onclick = () => {
    document.getElementById('apiKey')?.focus();
    document.getElementById('apiSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  document.getElementById('runDiagnostic').onclick = () => vscode.postMessage({ type: 'runDiagnostic' });

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
    statusBadge.className = 'status ' + (hasAny ? 'ok' : 'bad');
    statusBadge.textContent = hasAny ? 'Al menos una API activa' : 'Sin API Key';
    keyHint.textContent = s.hasApiKey
      ? 'Anthropic: ' + s.apiKeyHint + ' — chat, agente y @claude.'
      : 'Sin key Anthropic. Puedes usar solo OpenAI o ambas (con respaldo).';

    const openAiStatusBadge = document.getElementById('openAiStatusBadge');
    const openAiKeyHint = document.getElementById('openAiKeyHint');
    openAiStatusBadge.className = 'status ' + (s.hasOpenAiKey ? 'ok' : 'bad');
    openAiStatusBadge.textContent = s.hasOpenAiKey ? 'OpenAI activa' : 'OpenAI sin configurar';
    openAiKeyHint.textContent = s.hasOpenAiKey
      ? 'Key guardada: ' + s.openAiKeyHint + (s.fallbackEnabled ? ' · respaldo ON' : ' · respaldo OFF')
      : 'Opcional. Se usa si Claude falla o si no hay key Anthropic.';
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

    maxTokens.value = msg.maxTokens;
    if (msg.plan) plan.value = msg.plan;
    const vHint = document.getElementById('voyageHint');
    if (vHint) {
      vHint.textContent = msg.voyageHint && msg.voyageHint !== 'Sin configurar'
        ? 'Voyage: ' + msg.voyageHint + (msg.useEmbeddings ? ' · embeddings ON' : ' · embeddings OFF')
        : 'Sin Voyage key — RAG local TF-IDF.';
    }

    document.getElementById('sIn').textContent = s.sessionInputTokens.toLocaleString();
    document.getElementById('sOut').textContent = s.sessionOutputTokens.toLocaleString();
    document.getElementById('sCost').textContent = '$' + (s.sessionEstimatedCostUsd || 0).toFixed(4);
    const toolTotal = Object.values(s.sessionToolCalls || {}).reduce((a,b)=>a+b,0);
    document.getElementById('sTools').textContent = String(toolTotal);
    const breakdown = Object.entries(s.sessionToolCalls || {}).map(([k,v]) => k + ': ' + v).join(' · ');
    document.getElementById('toolBreakdown').textContent = breakdown || 'Sin tool calls en esta sesión.';
    document.getElementById('tIn').textContent = s.inputTokens.toLocaleString();
    document.getElementById('tOut').textContent = s.outputTokens.toLocaleString();
    document.getElementById('tCost').textContent = '$' + (s.estimatedCostUsd || 0).toFixed(4);
  });
</script>
</body>
</html>`;
  }
}
