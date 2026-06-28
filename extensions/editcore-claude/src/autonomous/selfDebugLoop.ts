/**
 * SELF DEBUG LOOP — Fase 6 (Prompt 4).
 */
import * as vscode from "vscode";
import { ApiKeyService } from "../apiKeyService";
import {
  runPostChangeValidation,
  saveValidationReport,
  type ValidationReport,
} from "../platform/postChangeValidator";
import { runAutonomousCoder } from "./autonomousCoder";
import { appendExecutionLog } from "./executionLog";

export interface SelfDebugResult {
  cycles: number;
  validation?: ValidationReport;
  fixed: boolean;
  log: string[];
}

export function getMaxDebugCycles(): number {
  return vscode.workspace.getConfiguration("editcore").get<number>("autonomous.maxDebugCycles", 3);
}

export async function runSelfDebugLoop(
  root: string,
  taskId: string,
  apiKeyService: ApiKeyService,
  objective: string,
  contextBlock: string
): Promise<SelfDebugResult> {
  const maxCycles = getMaxDebugCycles();
  const log: string[] = [];
  let cycles = 0;
  let validation: ValidationReport | undefined;
  let fixed = false;

  for (let i = 0; i < maxCycles; i++) {
    cycles = i + 1;
    validation = await runPostChangeValidation();
    if (!validation) {
      log.push("Ciclo " + cycles + ": sin comandos de validación configurados.");
      fixed = true;
      break;
    }

    await saveValidationReport(validation);
    await appendExecutionLog(root, {
      taskId,
      phase: "self_debug",
      action: "run_validation",
      detail: validation.results.map((r) => r.command + ": " + (r.success ? "OK" : "FAIL")).join(", "),
      success: validation.allPassed,
    });

    if (validation.allPassed) {
      log.push("Ciclo " + cycles + ": todas las pruebas pasaron.");
      fixed = true;
      break;
    }

    const failed = validation.results.find((r) => !r.success);
    const errorOutput = failed?.output ?? "Error desconocido";
    log.push("Ciclo " + cycles + ": falló `" + (failed?.command ?? "?") + "`");

    if (i === maxCycles - 1) {
      log.push("Máximo de ciclos alcanzado (" + maxCycles + ").");
      break;
    }

    const fixTask = [
      "Corrige el siguiente error detectado en las pruebas:",
      "",
      "Comando: " + (failed?.command ?? ""),
      "Salida:",
      "```",
      errorOutput.slice(-3000),
      "```",
      "",
      "Objetivo original: " + objective,
      "Aplica el fix mínimo necesario.",
    ].join("\n");

    const { output, success } = await runAutonomousCoder(
      apiKeyService,
      fixTask,
      contextBlock
    );

    await appendExecutionLog(root, {
      taskId,
      phase: "self_debug",
      action: "debug_fix",
      detail: output.slice(0, 1500),
      success,
    });

    log.push("Debug fix ciclo " + cycles + ": " + (success ? "ejecutado" : "falló"));
  }

  return { cycles, validation, fixed: fixed && (validation?.allPassed ?? true), log };
}
