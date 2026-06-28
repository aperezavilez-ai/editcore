/**
 * Seguridad empresarial — Fase 12 (Prompt 6).
 */
import * as vscode from "vscode";
import { appendAudit } from "../enterprise/orgConfig";
import { getCurrentUserRole, loadOrganization } from "./teamService";
import { roleHasPermission } from "./teamRoles";
import type { TeamPermission } from "./types";

export async function assertOrgPermission(permission: TeamPermission, action: string): Promise<boolean> {
  const enabled = vscode.workspace.getConfiguration("editcore").get<boolean>("ecosystem.security.enabled", true);
  if (!enabled) return true;

  const role = await getCurrentUserRole();
  if (roleHasPermission(role, permission)) {
    return true;
  }

  const choice = await vscode.window.showWarningMessage(
    "Sin permiso «" + permission + "» para: " + action + " (rol: " + role + ")",
    { modal: true },
    "Continuar como Owner (dev)",
    "Cancelar"
  );
  if (choice === "Continuar como Owner (dev)") {
    await appendAudit({ event: "security_override", permission, action, role });
    return true;
  }
  return false;
}

export async function assertOrgIsolation(resourceOrgId?: string): Promise<boolean> {
  const org = await loadOrganization();
  if (!org || !resourceOrgId) return true;
  if (org.id === resourceOrgId) return true;
  vscode.window.showErrorMessage("Recurso de otra organización — acceso denegado.");
  await appendAudit({ event: "org_isolation_block", resourceOrgId, localOrgId: org.id });
  return false;
}

export async function protectAgentExecution(agentId: string): Promise<boolean> {
  return assertOrgPermission("run_agents", "ejecutar agente " + agentId);
}

export async function logEnterpriseSecurityEvent(action: string, detail: string): Promise<void> {
  await appendAudit({ event: "enterprise_security", action, detail: detail.slice(0, 300) });
}
