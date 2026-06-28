/**
 * Seguridad autónoma — Fase 12 (Prompt 4).
 */
import * as path from "path";
import * as vscode from "vscode";
import { checkCommandSecurity, checkWritePermission, isAosSecurityEnabled } from "../aos/securityGuard";
import { appendAudit } from "../enterprise/orgConfig";
import { getAutonomyLevel } from "../autonomy/autonomyLevel";

const SENSITIVE_PATTERNS = [
  /\.env$/i,
  /credentials/i,
  /secrets?\./i,
  /\.pem$/i,
  /\.key$/i,
  /id_rsa/i,
  /service-account/i,
];

export interface AutonomousSecurityResult {
  allowed: boolean;
  reason?: string;
}

export function isSensitiveFile(filePath: string): boolean {
  const base = path.basename(filePath);
  return SENSITIVE_PATTERNS.some((p) => p.test(base) || p.test(filePath));
}

export function checkSensitiveWrite(filePath: string): AutonomousSecurityResult {
  if (!isAosSecurityEnabled()) {
    return { allowed: true };
  }
  if (isSensitiveFile(filePath)) {
    return {
      allowed: false,
      reason: "Archivo sensible protegido: " + path.basename(filePath),
    };
  }
  return { allowed: true };
}

export async function checkAutonomousCommand(command: string): Promise<AutonomousSecurityResult> {
  if (!isAosSecurityEnabled()) {
    return { allowed: true };
  }
  const sec = checkCommandSecurity(command);
  if (!sec.allowed) {
    await logAutonomousSecurityEvent("command_blocked", command, false);
    return { allowed: false, reason: sec.reason };
  }
  return { allowed: true };
}

export function checkAutonomousWrite(): AutonomousSecurityResult {
  const write = checkWritePermission();
  if (!write.allowed) {
    return { allowed: false, reason: write.reason };
  }
  return { allowed: true };
}

export async function confirmCriticalAction(action: string): Promise<boolean> {
  const requireConfirm = vscode.workspace
    .getConfiguration("editcore")
    .get<boolean>("autonomous.confirmCritical", true);
  if (!requireConfirm) {
    return true;
  }
  const choice = await vscode.window.showWarningMessage(
    "Acción crítica autónoma: " + action,
    { modal: true },
    "Confirmar",
    "Cancelar"
  );
  return choice === "Confirmar";
}

export async function logAutonomousSecurityEvent(
  action: string,
  detail: string,
  success: boolean
): Promise<void> {
  await appendAudit({
    event: "autonomous_security",
    action,
    success,
    detail: detail.slice(0, 500),
    level: getAutonomyLevel(),
  });
}
