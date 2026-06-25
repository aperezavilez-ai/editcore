import * as vscode from "vscode";
import { getWorkspaceContextBlock, getWorkspaceSnapshot } from "./workspaceContext";

/** Contexto automático del proyecto abierto para el chat nativo de EditCore/VS Code. */
export function registerWorkspaceContextProvider(context: vscode.ExtensionContext): void {
  if (typeof vscode.chat.registerChatWorkspaceContextProvider !== "function") {
    return;
  }

  const onDidChangeWorkspaceChatContext = new vscode.EventEmitter<void>();

  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      onDidChangeWorkspaceChatContext.fire();
    }),
    vscode.workspace.onDidSaveTextDocument((doc) => {
      if (doc.uri.scheme === "file" && doc.fileName.endsWith("package.json")) {
        onDidChangeWorkspaceChatContext.fire();
      }
    }),
    vscode.chat.registerChatWorkspaceContextProvider("editcore.workspace", {
      onDidChangeWorkspaceChatContext: onDidChangeWorkspaceChatContext.event,
      provideWorkspaceChatContext: async () => {
        const snap = await getWorkspaceSnapshot();
        const block = await getWorkspaceContextBlock();
        if (!snap || !block) {
          return [];
        }

        return [
          {
            label: snap.name,
            modelDescription: `Proyecto abierto en EditCore (${snap.root}). Usa esta información; no pidas al usuario que comparta archivos manualmente.`,
            value: block,
          },
        ];
      },
    })
  );
}
