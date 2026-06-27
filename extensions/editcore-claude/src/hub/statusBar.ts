import * as vscode from 'vscode';
import { LLM_CONFIG } from "../llmConfig";
import { getModelLabel, resolveClaudeModelId } from '../models';
import { getRagIndex } from '../rag/chunkIndex';
import { getWorkspaceIndex } from '../index/workspaceIndex';
import { getExtensionVersion, PRODUCT_NAME } from '../product/productVersion';

export function createStatusBarItem(
  context: vscode.ExtensionContext
): vscode.StatusBarItem {
  const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 50);
  item.command = 'editcore.commandHub';
  item.show();

  const refresh = () => {
    const config = vscode.workspace.getConfiguration('editcore');
    const model = resolveClaudeModelId(
      config.get<string>('model', LLM_CONFIG.claude.defaultModel)
    );
    const short = getModelLabel(model);
    const rag = getRagIndex().getStats();
    item.text = `$(sparkle) EditCore · ${short}`;
    item.tooltip = `EditCore Command Hub (Ctrl+Alt+E)\nModelo: ${model}\nRAG: ${rag.chunks} chunks · ${rag.files} archivos`;
  };

  refresh();
  context.subscriptions.push(
    item,
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('editcore.model')) refresh();
    })
  );

  // Actualizar stats RAG cuando termine el build en background
  setTimeout(refresh, 8000);

  return item;
}

export async function showAbout(): Promise<void> {
  const rag = getRagIndex().getStats();
  let indexed = 0;
  try {
    await getWorkspaceIndex().ensureIndexed();
    indexed = 1;
  } catch {
    indexed = 0;
  }

  const lines = [
    `**${PRODUCT_NAME} — Claude Assistant v${getExtensionVersion()}**`,
    '',
    '- Chat nativo `@claude` (Ask + Agent)',
    '- Autodiagnóstico (Ctrl+Alt+D) — checks + análisis Claude',
    '- 13+ tools: git, MCP, RAG, ADR, gemelo digital, autodiagnóstico',
    '- Habilidades integradas: @architect @gps @saas @security @founder @cto',
    '- Sesiones, audit log, org.json',
    `- Índice: keyword v2${indexed ? ' ✓' : ''} · RAG: ${rag.chunks} chunks`,
    '',
    '_Ctrl+Alt+E Command Hub · Ctrl+Alt+I Chat_',
  ];

  const doc = await vscode.workspace.openTextDocument({
    content: lines.join('\n'),
    language: 'markdown',
  });
  await vscode.window.showTextDocument(doc, { preview: true });
}
