import * as vscode from "vscode";

const CHAT_EDITOR_VIEW_TYPE = "workbench.editor.chatSession";

/** Cierra pestañas Chat del área de editor (no el panel lateral). */
export async function closeCentralChatEditorTabs(): Promise<void> {
  const tabsToClose: vscode.Tab[] = [];
  for (const group of vscode.window.tabGroups.all) {
    for (const tab of group.tabs) {
      if (isCentralChatTab(tab)) {
        tabsToClose.push(tab);
      }
    }
  }
  if (tabsToClose.length > 0) {
    await vscode.window.tabGroups.close(tabsToClose);
  }
}

function isCentralChatTab(tab: vscode.Tab): boolean {
  const input = tab.input;
  if (input instanceof vscode.TabInputCustom) {
    if (input.viewType === CHAT_EDITOR_VIEW_TYPE) {
      return true;
    }
  }
  if (input instanceof vscode.TabInputText) {
    const scheme = input.uri.scheme;
    if (
      scheme === "vscode-chat-editor" ||
      scheme === "vscode-local-chat-session" ||
      scheme.includes("chat")
    ) {
      return true;
    }
  }
  const label = tab.label?.trim().toLowerCase() ?? "";
  if (label === "chat" && input instanceof vscode.TabInputCustom) {
    return true;
  }
  return false;
}

/** Evita que reaparezca la pestaña Chat en el editor central. */
export function registerChatEditorGuard(context: vscode.ExtensionContext): void {
  const sweep = () => {
    void closeCentralChatEditorTabs();
  };

  context.subscriptions.push(
    vscode.window.tabGroups.onDidChangeTabs(sweep),
    vscode.window.onDidChangeActiveTextEditor(sweep),
    vscode.window.onDidChangeActiveNotebookEditor(sweep)
  );

  sweep();
  const t1 = setTimeout(sweep, 400);
  const t2 = setTimeout(sweep, 1500);
  context.subscriptions.push({ dispose: () => { clearTimeout(t1); clearTimeout(t2); } });
}
