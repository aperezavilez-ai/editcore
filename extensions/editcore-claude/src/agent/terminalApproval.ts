/**
 * terminalApproval.ts
 * -------------------------------------------------------------------------
 * Modal de aprobación de comandos de terminal para el Agent Mode.
 * Cada vez que Claude quiere ejecutar un comando, el usuario ve el comando
 * exacto y elige: Ejecutar / Editar comando / Cancelar.
 * -------------------------------------------------------------------------
 */

import * as vscode from 'vscode';
import { appendAudit } from '../enterprise/orgConfig';
import { isTaskTrusted, setTaskTrusted } from './agentTrust';

export type CommandApprovalDecision =
  | { action: 'run' }
  | { action: 'edit'; editedCommand: string }
  | { action: 'cancel' };

export async function requestCommandApproval(
  command: string,
  reason?: string
): Promise<CommandApprovalDecision> {
  if (isTaskTrusted()) {
    await appendAudit({ type: 'decision', kind: 'command', action: 'auto_trusted', command });
    return { action: 'run' };
  }

  const detail = reason ? `Motivo: ${reason}` : undefined;

  const choice = await vscode.window.showWarningMessage(
    `El agente quiere ejecutar:\n\n${command}`,
    { modal: true, detail },
    'Ejecutar',
    'Ejecutar y confiar en el resto de la tarea',
    'Editar comando',
    'Cancelar'
  );

  if (choice === 'Ejecutar y confiar en el resto de la tarea') {
    setTaskTrusted(true);
    await appendAudit({ type: 'decision', kind: 'command', action: 'run_and_trust', command });
    return { action: 'run' };
  }

  if (choice === 'Ejecutar') {
    await appendAudit({ type: 'decision', kind: 'command', action: 'run', command });
    return { action: 'run' };
  }

  if (choice === 'Editar comando') {
    const edited = await vscode.window.showInputBox({
      title: 'Editar comando antes de ejecutar',
      value: command,
      ignoreFocusOut: true,
    });
    if (!edited) {
      await appendAudit({ type: 'decision', kind: 'command', action: 'cancel', command });
      return { action: 'cancel' };
    }
    await appendAudit({ type: 'decision', kind: 'command', action: 'edit', command, editedCommand: edited });
    return { action: 'edit', editedCommand: edited };
  }

  await appendAudit({ type: 'decision', kind: 'command', action: 'cancel', command });
  return { action: 'cancel' };
}
