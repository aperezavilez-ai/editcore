import * as vscode from 'vscode';
import { getRagIndex } from '../rag/chunkIndex';
import { getWorkspaceIndex } from '../index/workspaceIndex';

export function createStatusBarItem(
  context: vscode.ExtensionContext
): vscode.StatusBarItem {
  const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 50);
  item.command = 'editcore.commandHub';
  item.show();

  const refresh = () => {
    const config = vscode.workspace.getConfiguration('editcore');
    const model = config.get<string>('model', 'claude-sonnet-4-6');
    const short = model.replace('claude-', '').replace(/-/g, ' ');
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
    '**EditCore IDE — Claude Assistant v1.1.0**',
    '',
    '- Chat nativo `@claude` (Ask + Agent)',
    '- Autodiagnóstico (Ctrl+Alt+D) — checks + análisis Claude',
    '- 13+ tools: git, MCP, RAG, ADR, gemelo digital, autodiagnóstico',
    '- Marketplace local + builders SaaS/GPS',
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
