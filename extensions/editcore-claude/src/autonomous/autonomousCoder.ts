/**
 * Agente programador autónomo — Fase 4 (Prompt 4).
 */
import { ApiKeyService } from "../apiKeyService";
import { runAgentTask, AgentEvent } from "../agent/agentLoop";
import { runOpenAiAgentTask } from "../agent/openaiAgentLoop";
import * as vscode from "vscode";

const CODER_INSTRUCTION = [
  "Eres el AUTONOMOUS CODER AGENT de EditCore.",
  "Reglas:",
  "- Respeta la arquitectura y convenciones del proyecto.",
  "- Cambios mínimos y verificables.",
  "- Usa apply_patch / write_file para modificar código real.",
  "- No elimines funcionalidades existentes.",
  "- No toques archivos sensibles (.env, credentials).",
  "- Tras cambios, ejecuta tests si es posible con run_command.",
].join("\n");

export interface CoderResult {
  output: string;
  success: boolean;
}

export async function runAutonomousCoder(
  apiKeyService: ApiKeyService,
  task: string,
  contextBlock: string,
  onText?: (text: string) => void
): Promise<CoderResult> {
  const useOpenAi = vscode.workspace
    .getConfiguration("editcore")
    .get<boolean>("agent.openAiForCoder", true);

  const fullTask = [contextBlock, "", CODER_INSTRUCTION, "", "## Tarea", task].join("\n");

  let output = "";
  const onEvent = (ev: AgentEvent) => {
    if (ev.type === "assistant_text") {
      output += ev.text;
      onText?.(ev.text);
    }
    if (ev.type === "error") {
      output += "\n[error] " + ev.message;
    }
  };

  try {
    if (useOpenAi) {
      const openAiKey = await apiKeyService.getOpenAiKey();
      if (openAiKey?.trim()) {
        await runOpenAiAgentTask(
          openAiKey,
          fullTask,
          onEvent,
          undefined,
          undefined,
          undefined,
          "fullstack",
          apiKeyService
        );
        return { output, success: !output.includes("[error]") };
      }
    }

    const claudeKey = await apiKeyService.getApiKey();
    if (!claudeKey?.trim()) {
      return { output: "Sin API keys configuradas.", success: false };
    }
    await runAgentTask(
      claudeKey,
      fullTask,
      onEvent,
      undefined,
      undefined,
      undefined,
      "fullstack",
      apiKeyService
    );
    return { output, success: !output.includes("[error]") };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { output: output + "\n" + msg, success: false };
  }
}
