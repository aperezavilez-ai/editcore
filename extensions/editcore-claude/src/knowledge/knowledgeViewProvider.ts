/**
 * EDITCORE KNOWLEDGE CENTER — Fase 12 (Prompt 5).
 */
import * as vscode from "vscode";
import { loadIndexMeta } from "./knowledgeIndexer";
import { loadProjectKnowledgeMap, formatProjectKnowledgeMarkdown } from "./projectKnowledgeEngine";
import { runSemanticAnalysis, formatSemanticFindingsMarkdown } from "./semanticAnalyzer";
import { listMemoryAudit } from "../memory/memorySecurity";
import { listConversationMemory } from "../memory/conversationMemory";
import { listChangeRecords } from "../memory/changeMemory";

export class KnowledgeCenterViewProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;

  constructor(private readonly context: vscode.ExtensionContext) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this.getHtml();

    webviewView.webview.onDidReceiveMessage(async (msg) => {
      if (msg.type === "reindex") {
        await vscode.commands.executeCommand("editcore.knowledge.reindex");
      } else if (msg.type === "search") {
        await vscode.commands.executeCommand("editcore.knowledge.search", msg.query);
      } else if (msg.type === "purge") {
        await vscode.commands.executeCommand("editcore.knowledge.purge");
      } else if (msg.type === "refresh") {
        await this.refresh();
      }
    });

    void this.refresh();
  }

  async refresh(): Promise<void> {
    if (!this.view) return;
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!root) {
      this.view.webview.postMessage({ type: "state", error: "Sin workspace" });
      return;
    }

    const [meta, map, findings, audit, convs, changes] = await Promise.all([
      loadIndexMeta(root),
      loadProjectKnowledgeMap(root),
      runSemanticAnalysis(root).catch(() => []),
      listMemoryAudit(10),
      listConversationMemory(5),
      listChangeRecords(root, 5),
    ]);

    this.view.webview.postMessage({
      type: "state",
      meta,
      mapSummary: map
        ? map.framework + " · " + map.indexedFileCount + " chunks · " + map.languages.join(", ")
        : "Sin mapa — ejecuta reindex",
      findings: findings.slice(0, 5),
      auditCount: audit.length,
      convCount: convs.length,
      changeCount: changes.length,
      markdown: map ? formatProjectKnowledgeMarkdown(map).slice(0, 3000) : "",
      semanticMd: formatSemanticFindingsMarkdown(findings),
    });
  }

  private getHtml(): string {
    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: var(--vscode-font-family); font-size: 12px; margin: 0; padding: 10px; color: var(--vscode-foreground); background: var(--vscode-sideBar-background); }
  h2 { font-size: 13px; margin: 0 0 8px; }
  .stat { padding: 8px; border-radius: 6px; background: var(--vscode-editor-background); margin-bottom: 8px; border: 1px solid var(--vscode-panel-border, #444); }
  button { width: 100%; margin: 4px 0; padding: 8px; cursor: pointer; border: none; border-radius: 6px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); font: inherit; }
  button.secondary { background: var(--vscode-editor-background); color: var(--vscode-foreground); border: 1px solid var(--vscode-panel-border); }
  input { width: 100%; box-sizing: border-box; padding: 6px; margin-bottom: 6px; border-radius: 4px; border: 1px solid var(--vscode-panel-border); background: var(--vscode-input-background); color: var(--vscode-input-foreground); }
  pre { white-space: pre-wrap; font-size: 11px; max-height: 200px; overflow: auto; }
  .finding { font-size: 11px; opacity: 0.9; margin: 2px 0; }
</style>
</head>
<body>
  <h2>Knowledge Center</h2>
  <div class="stat" id="summary">Cargando...</div>
  <input id="searchBox" placeholder="Buscar conocimiento..." />
  <button onclick="search()">Buscar</button>
  <button onclick="reindex()">Reindexar todo</button>
  <button class="secondary" onclick="refresh()">Actualizar</button>
  <button class="secondary" onclick="purge()">Purgar conocimiento local</button>
  <div id="findings"></div>
  <pre id="preview"></pre>
  <script>
    const vscode = acquireVsCodeApi();
    window.addEventListener('message', e => {
      if (e.data.type !== 'state') return;
      if (e.data.error) { document.getElementById('summary').textContent = e.data.error; return; }
      const m = e.data.meta;
      document.getElementById('summary').innerHTML =
        '<b>' + (e.data.mapSummary || '') + '</b><br/>' +
        (m ? 'Chunks: ' + m.codeChunks + ' · Memoria: ' + m.memoryRecords + ' · Cambios: ' + m.changeEntries : '');
      document.getElementById('findings').innerHTML = (e.data.findings || []).map(f =>
        '<div class="finding">• ' + f.kind + ': ' + f.message + '</div>'
      ).join('');
      document.getElementById('preview').textContent = e.data.semanticMd || '';
    });
    function reindex() { vscode.postMessage({ type: 'reindex' }); }
    function refresh() { vscode.postMessage({ type: 'refresh' }); }
    function purge() { vscode.postMessage({ type: 'purge' }); }
    function search() {
      const q = document.getElementById('searchBox').value;
      if (q) vscode.postMessage({ type: 'search', query: q });
    }
  </script>
</body>
</html>`;
  }
}
