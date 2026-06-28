/**
 * Seguridad del sistema IA — Fase 11 (Prompt 3).
 */
import * as vscode from "vscode";
import { appendAudit } from "../enterprise/orgConfig";
import { getAutonomyLevel, levelAllowsAction } from "../autonomy/autonomyLevel";

const DESTRUCTIVE_PATTERNS = [
  /rm\s+-rf/i,
  /git\s+reset\s+--hard/i,
  /git\s+push\s+--force/i,
  /drop\s+table/i,
  /truncate\s+table/i,
  /format\s+c:/i,
];

export interface SecurityCheckResult {
  allowed: boolean;
  reason?: string;
  requiresConfirmation: boolean;
}

export function checkCommandSecurity(command: string): SecurityCheckResult {
  for (const pattern of DESTRUCTIVE_PATTERNS) {
    if (pattern.test(command)) {
      return {
        allowed: false,
        reason: "Comando potencialmente destructivo bloqueado por Security Guard AOS.",
        requiresConfirmation: true,
      };
    }
  }
  return { allowed: true, requiresConfirmation: false };
}

export async function logAgentAction(
  action: string,
  agent: string,
  detail: string,
  success: boolean
): Promise<void> {
  await appendAudit({
    event: "aos_agent_action",
    agent,
    action,
    success,
    detail: detail.slice(0, 500),
    level: getAutonomyLevel(),
  });
}

export function checkWritePermission(): SecurityCheckResult {
  const level = getAutonomyLevel();
  if (!levelAllowsAction(level, "write_approved")) {
    return {
      allowed: false,
      reason: "Nivel " + level + " no permite escritura. Sube a nivel 3+.",
      requiresConfirmation: true,
    };
  }
  return { allowed: true, requiresConfirmation: level < 4 };
}

export function isAosSecurityEnabled(): boolean {
  return vscode.workspace.getConfiguration("editcore").get<boolean>("aos.security.enabled", true);
}
