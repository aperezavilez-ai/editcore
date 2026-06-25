/**
 * agentPanel.ts
 * -------------------------------------------------------------------------
 * Panel de webview para el Agent Mode: input de tarea + log en vivo de
 * lo que el agente va haciendo (texto, llamadas a tools, resultados).
 *
 * Registrar en extension.ts con un comando nuevo, ej:
 *   import { AgentPanel } from './agent/agentPanel';
 *   context.subscriptions.push(
 *     vscode.commands.registerCommand('editcore.openAgent', () => AgentPanel.show(context))
 *   );
 * Y en package.json, agregar el comando a "contributes.commands"
 * (ver INTEGRACION.md).
 * -------------------------------------------------------------------------
 */

import * as vscode from 'vscode';
import { runAgentTask, AgentEvent } from './agentLoop';
import { ApiKeyService } from '../apiKeyService';

export class AgentPanel {
  private static current: AgentPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly apiKeyService: ApiKeyService;
  private abortController: AbortController | undefined;

  static show(context: vscode.ExtensionContext, apiKeyService: ApiKeyService) {
    if (AgentPanel.current) {
      AgentPanel.current.panel.reveal();
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      'editcoreAgent',
      'EditCore Agent',
      vscode.ViewColumn.Beside,
      { enableScripts: true, retainContextWhenHidden: true }
    );
    AgentPanel.current = new AgentPanel(panel, apiKeyService);
    panel.onDidDispose(() => (AgentPanel.current = undefined));
  }

  private constructor(
    panel: vscode.WebviewPanel,
    apiKeyService: ApiKeyService
  ) {
    this.panel = panel;
    this.apiKeyService = apiKeyService;
    this.panel.webview.html = this.getHtml();

    this.panel.webview.onDidReceiveMessage(async (msg) => {
      if (msg.type === 'submit_task') {
        await this.startTask(msg.task);
      } else if (msg.type === 'cancel_task') {
        this.abortController?.abort();
      }
    });
  }

  private async startTask(task: string) {
    const hasKey = await this.apiKeyService.hasAnyLlmKey();
    if (!hasKey) {
      const choice = await vscode.window.showWarningMessage(
        'No has configurado ninguna API Key (Anthropic u OpenAI).',
        'Abrir Cuenta & API'
      );
      if (choice === 'Abrir Cuenta & API') {
        await vscode.commands.executeCommand('editcore.openAccountPanel');
      }
      this.post({ type: 'error', message: 'Configura una API Key en EditCore → Cuenta & API.' });
      return;
    }

    const apiKey = (await this.apiKeyService.getApiKey()) ?? '';

    this.abortController = new AbortController();
    this.post({ type: 'task_started' });

    await runAgentTask(
      apiKey,
      task,
      (event: AgentEvent) => this.post(event),
      this.abortController.signal,
      (input, output) => this.apiKeyService.recordUsage(input, output),
      (toolName) => this.apiKeyService.recordToolCall(toolName),
      'default',
      this.apiKeyService
    );
  }

  private post(message: any) {
    this.panel.webview.postMessage(message);
  }

  private getHtml(): string {
    return /* html */ `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground);
         background: var(--vscode-editor-background); padding: 12px; }
  #task { width: 100%; box-sizing: border-box; min-height: 60px; }
  #log { margin-top: 12px; display: flex; flex-direction: column; gap: 6px; }
  .entry { padding: 6px 8px; border-radius: 4px; font-size: 13px; white-space: pre-wrap; }
  .text { background: var(--vscode-editorWidget-background); }
  .tool-call { background: var(--vscode-inputValidation-infoBackground); }
  .tool-result { background: var(--vscode-textBlockQuote-background); font-family: var(--vscode-editor-font-family); }
  .tool-error { background: var(--vscode-inputValidation-errorBackground); }
  .done { font-weight: bold; }
  button { margin-top: 8px; }
</style>
</head>
<body>
  <textarea id="task" placeholder="Describí la tarea para el agente, ej: 'Agregá validación de email en el formulario de login'"></textarea>
  <div>
    <button id="run">Iniciar agente</button>
    <button id="cancel" disabled>Cancelar</button>
  </div>
  <div id="log"></div>

  <script>
    const vscode = acquireVsCodeApi();
    const log = document.getElementById('log');
    const runBtn = document.getElementById('run');
    const cancelBtn = document.getElementById('cancel');

    function addEntry(cls, text) {
      const div = document.createElement('div');
      div.className = 'entry ' + cls;
      div.textContent = text;
      log.appendChild(div);
      div.scrollIntoView({ block: 'end' });
    }

    runBtn.addEventListener('click', () => {
      const task = document.getElementById('task').value.trim();
      if (!task) return;
      log.innerHTML = '';
      runBtn.disabled = true;
      cancelBtn.disabled = false;
      vscode.postMessage({ type: 'submit_task', task });
    });

    cancelBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'cancel_task' });
    });

    window.addEventListener('message', (event) => {
      const msg = event.data;
      switch (msg.type) {
        case 'assistant_text':
          addEntry('text', msg.text);
          break;
        case 'tool_call_start':
          addEntry('tool-call', '🔧 ' + msg.name + '(' + JSON.stringify(msg.input) + ')');
          break;
        case 'tool_call_result':
          addEntry(msg.isError ? 'tool-error' : 'tool-result', msg.output);
          break;
        case 'done':
          addEntry('done', '✅ Terminado (' + msg.reason + ')');
          runBtn.disabled = false;
          cancelBtn.disabled = true;
          break;
        case 'error':
          addEntry('tool-error', '❌ ' + msg.message);
          runBtn.disabled = false;
          cancelBtn.disabled = true;
          break;
      }
    });
  </script>
</body>
</html>`;
  }
}
