import * as vscode from 'vscode';
import { ApiKeyService } from '../apiKeyService';
import {
  exportLastDiagnostic,
  runQuickDiagnostic,
  runSelfDiagnostic,
} from './diagnosticService';

export function registerDiagnosticCommands(
  context: vscode.ExtensionContext,
  apiKeyService: ApiKeyService
): vscode.StatusBarItem {
  context.subscriptions.push(
    vscode.commands.registerCommand('editcore.selfDiagnostic', () =>
      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'EditCore: autodiagnóstico en curso...',
          cancellable: false,
        },
        () => runSelfDiagnostic(context, apiKeyService)
      )
    ),
    vscode.commands.registerCommand('editcore.selfDiagnostic.quick', () =>
      runQuickDiagnostic(context, apiKeyService)
    ),
    vscode.commands.registerCommand('editcore.selfDiagnostic.export', () => exportLastDiagnostic())
  );

  const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 200);
  item.command = 'editcore.selfDiagnostic';
  item.text = '$(pulse) Autodiagnóstico';
  item.tooltip = 'EditCore: autodiagnóstico del IDE y del proyecto (Ctrl+Alt+D)';
  item.show();
  context.subscriptions.push(item);
  return item;
}
