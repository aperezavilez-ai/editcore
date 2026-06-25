import * as vscode from "vscode";
import { ApiKeyService } from "./apiKeyService";
import { streamWithFallback } from "./aiRouter";
import type { ChatMessage } from "./anthropicClient";
import { getModelLabel, getOpenAiModelLabel } from "./models";

export class ClaudeChatViewProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private history: ChatMessage[] = [];

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly apiKeyService: ApiKeyService
  ) {
    context.subscriptions.push(
      apiKeyService.onDidChange(() => this.pushStatus()),
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("editcore")) {
          this.pushStatus();
        }
      })
    );
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this.getHtml();

    webviewView.webview.onDidReceiveMessage(async (msg) => {
      if (msg.type === "send") {
        await this.handleUserMessage(msg.text);
      } else if (msg.type === "insertCode") {
        this.insertIntoActiveEditor(msg.code);
      } else if (msg.type === "openAccount") {
        await vscode.commands.executeCommand("editcore.openAccountPanel");
      }
    });

    void this.pushStatus();
  }

  reveal(): void {
    this.view?.show?.(true);
  }

  postAssistantMessage(text: string): void {
    this.history.push({ role: "assistant", content: text });
    this.view?.webview.postMessage({ type: "assistantFull", text });
  }

  private async pushStatus(): Promise<void> {
    if (!this.view) {
      return;
    }
    const snapshot = await this.apiKeyService.getSnapshot();
    this.view.webview.postMessage({
      type: "status",
      hasApiKey: snapshot.hasApiKey || snapshot.hasOpenAiKey,
      modelLabel: getModelLabel(snapshot.model),
      openAiModelLabel: getOpenAiModelLabel(snapshot.openAiModel),
      fallbackEnabled: snapshot.fallbackEnabled,
      sessionIn: snapshot.sessionInputTokens,
      sessionOut: snapshot.sessionOutputTokens,
    });
  }

  private async handleUserMessage(text: string): Promise<void> {
    const hasKey = await this.apiKeyService.hasAnyLlmKey();
    if (!hasKey) {
      this.view?.webview.postMessage({
        type: "error",
        text: "Configura una API Key (Anthropic u OpenAI) en EditCore → Cuenta & API.",
      });
      return;
    }

    this.history.push({ role: "user", content: text });
    this.view?.webview.postMessage({ type: "userEcho", text });
    this.view?.webview.postMessage({ type: "assistantStart" });

    let fullText = "";
    try {
      const usage = await streamWithFallback(this.apiKeyService, this.history, (token) => {
        fullText += token;
        this.view?.webview.postMessage({ type: "assistantToken", text: token });
      });
      this.history.push({ role: "assistant", content: fullText });
      this.apiKeyService.recordUsage(usage.inputTokens, usage.outputTokens);
      const providerLabel = usage.provider === "openai" ? "OpenAI" : "Claude";
      const fallbackNote = usage.usedFallback ? " · respaldo OpenAI" : "";
      this.view?.webview.postMessage({
        type: "assistantDone",
        usage: `Tokens ↑${usage.inputTokens} ↓${usage.outputTokens} · ${providerLabel}${fallbackNote}`,
      });
      await this.pushStatus();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al contactar al proveedor de IA.";
      this.view?.webview.postMessage({ type: "error", text: message });
    }
  }

  private insertIntoActiveEditor(code: string): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage("Abre un archivo primero para insertar el código.");
      return;
    }
    void editor.edit((builder) => {
      builder.insert(editor.selection.active, code);
    });
  }

  private getHtml(): string {
    return /* html */ `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body { font-family: var(--vscode-font-family); background: var(--vscode-sideBar-background);
    color: var(--vscode-foreground); margin:0; padding:0; display:flex; flex-direction:column; height:100vh; }
  #header { padding:8px 10px; border-bottom:1px solid var(--vscode-panel-border); }
  #headerTop { display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; }
  #header button { font-size:11px; background:none; border:1px solid var(--vscode-panel-border,transparent);
    color:var(--vscode-foreground); padding:3px 8px; border-radius:4px; cursor:pointer; }
  #header button:hover { background: var(--vscode-toolbar-hoverBackground); }
  #meta { font-size:11px; opacity:.75; }
  #messages { flex:1; overflow-y:auto; padding:10px; display:flex; flex-direction:column; gap:10px; }
  .msg { padding:8px 10px; border-radius:6px; font-size:13px; line-height:1.5; white-space:pre-wrap; word-break:break-word; }
  .msg.user { background: var(--vscode-input-background); align-self:flex-end; max-width:90%; }
  .msg.assistant { background: var(--vscode-editor-inactiveSelectionBackground); max-width:95%; }
  .msg.error { background: var(--vscode-inputValidation-errorBackground); color: var(--vscode-inputValidation-errorForeground); }
  .usage { font-size:10px; opacity:.65; margin-top:4px; }
  pre { background: var(--vscode-textCodeBlock-background); padding:8px; border-radius:4px; overflow-x:auto; font-size:12px; position:relative; }
  .insert-btn { position:absolute; top:4px; right:4px; font-size:10px; background:var(--vscode-button-background);
    color:var(--vscode-button-foreground); border:none; border-radius:3px; padding:2px 6px; cursor:pointer; }
  #inputRow { display:flex; gap:6px; padding:8px; border-top:1px solid var(--vscode-panel-border); }
  #inputBox { flex:1; resize:none; background:var(--vscode-input-background); color:var(--vscode-input-foreground);
    border:1px solid var(--vscode-input-border,transparent); border-radius:4px; padding:6px 8px; font-family:inherit; font-size:13px; }
  #sendBtn { background:var(--vscode-button-background); color:var(--vscode-button-foreground); border:none;
    border-radius:4px; padding:0 14px; cursor:pointer; }
</style>
</head>
<body>
  <div id="header">
    <div id="headerTop">
      <span style="font-size:12px; font-weight:600;">Chat con Claude</span>
      <button id="accountBtn">Cuenta &amp; API</button>
    </div>
    <div id="meta">Modelo: <span id="modelLabel">—</span> · Sesión: ↑<span id="sessIn">0</span> ↓<span id="sessOut">0</span></div>
  </div>
  <div id="messages"></div>
  <div id="inputRow">
    <textarea id="inputBox" rows="2" placeholder="Pregúntale a Claude..."></textarea>
    <button id="sendBtn">Enviar</button>
  </div>

<script>
  const vscode = acquireVsCodeApi();
  const messagesEl = document.getElementById('messages');
  const inputBox = document.getElementById('inputBox');
  const sendBtn = document.getElementById('sendBtn');
  const accountBtn = document.getElementById('accountBtn');
  let currentAssistantEl = null;
  let currentAssistantRaw = '';

  accountBtn.addEventListener('click', () => vscode.postMessage({ type: 'openAccount' }));

  function escapeHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function renderMarkdownLite(text) {
    const parts = text.split(/(\`\`\`[a-zA-Z]*\\n[\\s\\S]*?\`\`\`)/g);
    return parts.map(part => {
      const m = part.match(/^\`\`\`[a-zA-Z]*\\n([\\s\\S]*?)\`\`\`$/);
      if (m) {
        const code = m[1];
        const id = 'code_' + Math.random().toString(36).slice(2);
        setTimeout(() => {
          const btn = document.getElementById(id);
          if (btn) btn.addEventListener('click', () => vscode.postMessage({ type: 'insertCode', code }));
        }, 0);
        return '<pre><button class="insert-btn" id="' + id + '">Insertar</button>' + escapeHtml(code) + '</pre>';
      }
      return escapeHtml(part);
    }).join('');
  }

  function addMessage(role, text, usage) {
    const div = document.createElement('div');
    div.className = 'msg ' + role;
    div.innerHTML = renderMarkdownLite(text);
    if (usage) {
      const u = document.createElement('div');
      u.className = 'usage';
      u.textContent = usage;
      div.appendChild(u);
    }
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  }

  function send() {
    const text = inputBox.value.trim();
    if (!text) return;
    inputBox.value = '';
    vscode.postMessage({ type: 'send', text });
  }

  sendBtn.addEventListener('click', send);
  inputBox.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (msg.type === 'status') {
      document.getElementById('modelLabel').textContent = msg.modelLabel;
      document.getElementById('sessIn').textContent = msg.sessionIn.toLocaleString();
      document.getElementById('sessOut').textContent = msg.sessionOut.toLocaleString();
    } else if (msg.type === 'userEcho') {
      addMessage('user', msg.text);
    } else if (msg.type === 'assistantStart') {
      currentAssistantRaw = '';
      currentAssistantEl = addMessage('assistant', '');
    } else if (msg.type === 'assistantToken') {
      currentAssistantRaw += msg.text;
      if (currentAssistantEl) currentAssistantEl.innerHTML = renderMarkdownLite(currentAssistantRaw);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    } else if (msg.type === 'assistantDone') {
      if (currentAssistantEl && msg.usage) {
        const u = document.createElement('div');
        u.className = 'usage';
        u.textContent = msg.usage;
        currentAssistantEl.appendChild(u);
      }
      currentAssistantEl = null;
    } else if (msg.type === 'assistantFull') {
      addMessage('assistant', msg.text);
    } else if (msg.type === 'error') {
      addMessage('error', msg.text);
    }
  });
</script>
</body>
</html>`;
  }
}
