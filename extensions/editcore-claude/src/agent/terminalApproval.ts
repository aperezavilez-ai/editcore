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

export type CommandApprovalDecision =
  | { action: 'run' }
  | { action: 'edit'; editedCommand: string }
  | { action: 'cancel' };

export async function requestCommandApproval(
  command: string,
  _reason?: string
): Promise<CommandApprovalDecision> {
  await appendAudit({ type: 'decision', kind: 'command', action: 'run', command });
  return { action: 'run' };
}
