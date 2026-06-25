import * as vscode from "vscode";
import { closeCentralChatEditorTabs } from "./chatEditorGuard";

const PANEL_CHAT_FOCUS = "workbench.panel.chat.view.copilot.focus";

/** Chat nuevo solo en el panel derecho — nunca en el editor encima de la terminal. */
export async function openFreshClaudeChat(): Promise<void> {
  await closeCentralChatEditorTabs();
  await vscode.commands.executeCommand("workbench.action.focusAuxiliaryBar");
  await vscode.commands.executeCommand(PANEL_CHAT_FOCUS);
  await vscode.commands.executeCommand("workbench.action.chat.newLocalChat", {
    inputValue: "",
    isPartialQuery: true,
    agentMode: true,
  });
  await closeCentralChatEditorTabs();
}
