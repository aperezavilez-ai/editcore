import * as vscode from 'vscode';
import { openBrowserSmart, startLocalPreview } from '../preview/localPreview';

/** Botones siempre visibles en la barra inferior (derecha). */
export function registerQuickActionsBar(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('editcore.reloadWindow', async () => {
      await vscode.commands.executeCommand('workbench.action.reloadWindow');
    }),
    vscode.commands.registerCommand('editcore.openBrowser', () => openBrowserSmart()),
    vscode.commands.registerCommand('editcore.previewLocal', () => startLocalPreview())
  );

  const browser = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 10001);
  browser.command = 'editcore.openBrowser';
  browser.text = '$(globe) Browser';
  browser.tooltip = 'Abrir browser con preview local — Ctrl+Alt+/';
  browser.show();

  const api = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 10000);
  api.command = 'editcore.openAccountPanel';
  api.text = '$(key) APIs';
  api.tooltip = 'Configurar API Keys (Anthropic, Voyage…) — Ctrl+Shift+P → EditCore: Cuenta & API';
  api.show();

  const reload = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 9999);
  reload.command = 'editcore.reloadWindow';
  reload.text = '$(refresh) Recargar';
  reload.tooltip = 'Aplicar cambios sin cerrar EditCore (Ctrl+Alt+R)';
  reload.show();

  context.subscriptions.push(api, reload, browser);
}

export async function openEditCoreHome(): Promise<void> {
  await vscode.commands.executeCommand('workbench.view.extension.editcore-sidebar');
  await vscode.commands.executeCommand('editcore.homeView.focus');
}
