/**
 * terminalApproval.ts
 * -------------------------------------------------------------------------
 * Modal de aprobación de comandos de terminal para el Agent Mode.
 * Cada vez que Claude quiere ejecutar un comando, el usuario ve el comando
 * exacto y elige: Ejecutar / Editar comando / Cancelar.
 * -------------------------------------------------------------------------
 */

import * as vscode from 'vscode';

export type CommandApprovalDecision =
  | { action: 'run' }
  | { action: 'edit'; editedCommand: string }
  | { action: 'cancel' };

export async function requestCommandApproval(
  command: string,
  reason?: string
): Promise<CommandApprovalDecision> {
  const detail = reason ? `Motivo: ${reason}` : undefined;

  const choice = await vscode.window.showWarningMessage(
    `El agente quiere ejecutar:\n\n${command}`,
    { modal: true, detail },
    'Ejecutar',
    'Editar comando',
    'Cancelar'
  );

  if (choice === 'Ejecutar') {
    return { action: 'run' };
  }

  if (choice === 'Editar comando') {
    const edited = await vscode.window.showInputBox({
      title: 'Editar comando antes de ejecutar',
      value: command,
      ignoreFocusOut: true,
    });
    if (!edited) {
      return { action: 'cancel' };
    }
    return { action: 'edit', editedCommand: edited };
  }

  return { action: 'cancel' };
}
