import * as vscode from "vscode";
import type Anthropic from "@anthropic-ai/sdk";
import { ApiKeyService } from "./apiKeyService";
import type { ChatMessage } from "./anthropicClient";
import { getModelLabel, getOpenAiModelLabel } from "./models";
import { runAgentTask, AgentEvent } from "./agent/agentLoop";

export class ClaudeChatViewProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private history: ChatMessage[] = [];
  private agentConversation: Anthropic.Messages.MessageParam[] = [];
  private abortController: AbortController | undefined;

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
      } else if (msg.type === "cancel") {
        this.abortController?.abort();
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
    this.view?.webview.postMessage({ type: "agentBusy", busy: true });

    const apiKey = (await this.apiKeyService.getApiKey()) ?? "";
    this.abortController = new AbortController();

    let fullText = "";
    try {
      await runAgentTask(
        apiKey,
        text,
        (event: AgentEvent) => {
          switch (event.type) {
            case "assistant_text":
              fullText += (fullText ? "\n\n" : "") + event.text;
              this.view?.webview.postMessage({ type: "assistantFull", text: event.text });
              break;
            case "tool_call_start":
              this.view?.webview.postMessage({
                type: "toolCallStart",
                name: event.name,
                input: event.input,
              });
              break;
            case "tool_call_result":
              this.view?.webview.postMessage({
                type: "toolCallResult",
                name: event.name,
                output: event.output,
                isError: event.isError,
              });
              break;
            case "done":
              this.view?.webview.postMessage({ type: "agentBusy", busy: false });
              break;
            case "error":
              this.view?.webview.postMessage({ type: "error", text: event.message });
              this.view?.webview.postMessage({ type: "agentBusy", busy: false });
              break;
          }
        },
        this.abortController.signal,
        (inputTokens, outputTokens) => this.apiKeyService.recordUsage(inputTokens, outputTokens),
        (toolName) => this.apiKeyService.recordToolCall(toolName),
        "default",
        this.apiKeyService,
        this.agentConversation
      );
      this.history.push({ role: "assistant", content: fullText });
      await this.pushStatus();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al contactar al proveedor de IA.";
      this.view?.webview.postMessage({ type: "error", text: message });
      this.view?.webview.postMessage({ type: "agentBusy", busy: false });
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
  .msg.tool-call { background: var(--vscode-inputValidation-infoBackground); font-size:12px; font-family:var(--vscode-editor-font-family); }
  .msg.tool-result { background: var(--vscode-textBlockQuote-background); font-size:12px; font-family:var(--vscode-editor-font-family); }
  .msg.tool-error { background: var(--vscode-inputValidation-errorBackground); font-size:12px; font-family:var(--vscode-editor-font-family); }
  .msg.busy { background:none; opacity:.7; font-style:italic; font-size:12px; }
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
      <span style="font-size:12px; font-weight:600;">Chat</span>
      <button id="accountBtn">Cuenta &amp; API</button>
    </div>
    <div id="meta">Modelo: <span id="modelLabel">—</span> · Sesión: ↑<span id="sessIn">0</span> ↓<span id="sessOut">0</span></div>
  </div>
  <div id="messages"></div>
  <div id="inputRow">
    <textarea id="inputBox" rows="2" placeholder="Describe qué quieres construir..."></textarea>
    <button id="sendBtn">Enviar</button>
    <button id="cancelBtn" style="display:none;">Cancelar</button>
  </div>

<script>
  const vscode = acquireVsCodeApi();
  const messagesEl = document.getElementById('messages');
  const inputBox = document.getElementById('inputBox');
  const sendBtn = document.getElementById('sendBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const accountBtn = document.getElementById('accountBtn');
  let busyEl = null;

  accountBtn.addEventListener('click', () => vscode.postMessage({ type: 'openAccount' }));
  cancelBtn.addEventListener('click', () => vscode.postMessage({ type: 'cancel' }));

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

  function setBusy(isBusy) {
    sendBtn.disabled = isBusy;
    cancelBtn.style.display = isBusy ? 'inline-block' : 'none';
    if (isBusy && !busyEl) {
      busyEl = addMessage('busy', 'Pensando / ejecutando herramientas…');
    } else if (!isBusy && busyEl) {
      busyEl.remove();
      busyEl = null;
    }
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
    } else if (msg.type === 'assistantFull') {
      addMessage('assistant', msg.text);
    } else if (msg.type === 'toolCallStart') {
      addMessage('tool-call', '🔧 ' + msg.name + '(' + JSON.stringify(msg.input) + ')');
    } else if (msg.type === 'toolCallResult') {
      addMessage(msg.isError ? 'tool-error' : 'tool-result', String(msg.output).slice(0, 4000));
    } else if (msg.type === 'agentBusy') {
      setBusy(!!msg.busy);
    } else if (msg.type === 'error') {
      addMessage('error', msg.text);
      setBusy(false);
    }
  });
</script>
</body>
</html>`;
  }
}
