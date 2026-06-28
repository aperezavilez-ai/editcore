/**
 * Modo Copiloto vs Autónomo — Fase 8 (Prompt 4).
 */
import * as vscode from "vscode";
import { getAutonomyLevel } from "../autonomy/autonomyLevel";
import type { WorkMode } from "./types";

export function getWorkMode(): WorkMode {
  const configured = vscode.workspace
    .getConfiguration("editcore")
    .get<string>("autonomous.mode", "copilot");
  if (configured === "autonomous") {
    return "autonomous";
  }
  return "copilot";
}

export function isCopilotMode(): boolean {
  return getWorkMode() === "copilot";
}

export function isAutonomousMode(): boolean {
  return getWorkMode() === "autonomous";
}

export function isAutonomousEngineEnabled(): boolean {
  return vscode.workspace.getConfiguration("editcore").get<boolean>("autonomous.enabled", true);
}

/** En copiloto o nivel bajo, pide aprobación antes de escribir código. */
export async function requiresImplementationApproval(reason: string): Promise<boolean> {
  const mode = getWorkMode();
  const level = getAutonomyLevel();

  if (mode === "autonomous" && level >= 4) {
    return true;
  }
  if (mode === "autonomous" && level >= 3) {
    const auto = vscode.workspace
      .getConfiguration("editcore")
      .get<boolean>("autonomous.autoApproveWrites", false);
    if (auto) {
      return true;
    }
  }

  const choice = await vscode.window.showWarningMessage(
    "EditCore (" + mode + ", nivel " + level + "): " + reason,
    { modal: true },
    "Aprobar e implementar",
    "Solo plan (sin código)",
    "Cancelar"
  );
  if (choice === "Aprobar e implementar") {
    return true;
  }
  if (choice === "Solo plan (sin código)") {
    return false;
  }
  throw new Error("Operación cancelada por el usuario.");
}

export async function setWorkMode(mode: WorkMode): Promise<void> {
  await vscode.workspace
    .getConfiguration("editcore")
    .update("autonomous.mode", mode, vscode.ConfigurationTarget.Workspace);
}
