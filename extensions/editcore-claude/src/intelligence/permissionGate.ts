import * as vscode from "vscode";
import type { IntelligencePermission } from "./types";

const PERMISSION_RANK: Record<IntelligencePermission, number> = {
  read: 0,
  write_docs: 1,
  write_config: 2,
  write_code: 3,
};

export function isIntelligenceEnabled(): boolean {
  return vscode.workspace
    .getConfiguration("editcore")
    .get<boolean>("intelligence.enabled", false);
}

export function getMaxPermissionLevel(): IntelligencePermission {
  const raw = vscode.workspace
    .getConfiguration("editcore")
    .get<string>("intelligence.permissionLevel", "read");
  if (raw === "write_docs" || raw === "write_config" || raw === "write_code") {
    return raw;
  }
  return "read";
}

export function hasPermission(required: IntelligencePermission): boolean {
  if (!isIntelligenceEnabled() && required !== "read") {
    return false;
  }
  return PERMISSION_RANK[getMaxPermissionLevel()] >= PERMISSION_RANK[required];
}

export async function assertIntelligenceEnabled(): Promise<void> {
  if (!isIntelligenceEnabled()) {
    const enable = await vscode.window.showInformationMessage(
      "EditCore System Intelligence está desactivada. ¿Activarla ahora?",
      "Activar",
      "Cancelar"
    );
    if (enable !== "Activar") {
      throw new Error("System Intelligence Layer desactivada.");
    }
    await vscode.workspace
      .getConfiguration("editcore")
      .update("intelligence.enabled", true, vscode.ConfigurationTarget.Global);
  }
}

export async function requestPermission(
  required: IntelligencePermission,
  reason: string
): Promise<boolean> {
  if (hasPermission(required)) {
    return true;
  }
  const choice = await vscode.window.showWarningMessage(
    `EditCore SIL solicita permiso «${required}»: ${reason}`,
    { modal: true },
    "Aprobar",
    "Denegar"
  );
  return choice === "Aprobar";
}
