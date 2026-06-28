/**
 * Niveles de autonomía 1–5 (Evolution Execution System — Fase 9).
 */
import * as vscode from "vscode";

export type AutonomyLevel = 1 | 2 | 3 | 4 | 5;

export type AutonomyAction =
  | "analyze"
  | "plan"
  | "write_approved"
  | "execute_tasks"
  | "continuous";

export interface AutonomyLevelInfo {
  level: AutonomyLevel;
  label: string;
  description: string;
}

export const AUTONOMY_LEVELS: AutonomyLevelInfo[] = [
  {
    level: 1,
    label: "Analizar y recomendar",
    description: "Diagnóstico, health, snapshots. Sin escritura en código.",
  },
  {
    level: 2,
    label: "Crear planes",
    description: "Genera PLAN_IMPLEMENTACION, colas de tareas y documentación.",
  },
  {
    level: 3,
    label: "Aplicar cambios aprobados",
    description: "Agente con diff aprobado; crea rama git antes de cambios grandes.",
  },
  {
    level: 4,
    label: "Tareas completas con pruebas",
    description: "Ejecuta cola de autonomía + validación post-cambio.",
  },
  {
    level: 5,
    label: "Optimización continua supervisada",
    description: "Ciclos de evolución programados + reportes automáticos.",
  },
];

export function getAutonomyLevel(): AutonomyLevel {
  const raw = vscode.workspace.getConfiguration("editcore").get<number>("autonomy.level", 2);
  if (raw >= 1 && raw <= 5) {
    return raw as AutonomyLevel;
  }
  return 2;
}

export function levelAllowsAction(level: AutonomyLevel, action: AutonomyAction): boolean {
  const matrix: Record<AutonomyAction, AutonomyLevel> = {
    analyze: 1,
    plan: 2,
    write_approved: 3,
    execute_tasks: 4,
    continuous: 5,
  };
  return level >= matrix[action];
}

export async function assertAutonomyAction(
  action: AutonomyAction,
  reason: string
): Promise<boolean> {
  const level = getAutonomyLevel();
  if (levelAllowsAction(level, action)) {
    return true;
  }
  const required = AUTONOMY_LEVELS.find((l) => {
    const min: Record<AutonomyAction, AutonomyLevel> = {
      analyze: 1,
      plan: 2,
      write_approved: 3,
      execute_tasks: 4,
      continuous: 5,
    };
    return l.level === min[action];
  });
  const choice = await vscode.window.showWarningMessage(
    `EditCore requiere nivel ${required?.level ?? "?"} (${required?.label}) para: ${reason}. Nivel actual: ${level}.`,
    { modal: true },
    "Subir nivel temporalmente",
    "Cancelar"
  );
  if (choice === "Subir nivel temporalmente") {
    const minLevel = { analyze: 1, plan: 2, write_approved: 3, execute_tasks: 4, continuous: 5 }[action];
    await vscode.workspace
      .getConfiguration("editcore")
      .update("autonomy.level", minLevel, vscode.ConfigurationTarget.Workspace);
    return true;
  }
  return false;
}

export function mapLevelToPermissionLevel(
  level: AutonomyLevel
): "read" | "write_docs" | "write_config" | "write_code" {
  if (level >= 4) return "write_code";
  if (level >= 3) return "write_config";
  if (level >= 2) return "write_docs";
  return "read";
}
