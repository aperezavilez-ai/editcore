import * as vscode from "vscode";

/** Campos de modo expuestos por EditCore (proposal chatParticipantAdditions / chatParticipantPrivate). */
export interface ChatRequestModeInstructions {
  readonly name: string;
  readonly isBuiltin?: boolean;
}

export type ChatRequestWithMode = vscode.ChatRequest & {
  readonly modeInstructions2?: ChatRequestModeInstructions;
  readonly tools?: Map<string, unknown>;
};

export function isAgentMode(request: vscode.ChatRequest): boolean {
  const mode = (request as ChatRequestWithMode).modeInstructions2;
  if (mode?.name) {
    const name = mode.name.toLowerCase();
    if (name === "ask" || name === "edit") {
      return false;
    }
    if (name === "agent") {
      return true;
    }
    return mode.isBuiltin === false;
  }
  return false;
}

/**
 * Usa el agente con herramientas reales. Si el workbench no pasa el modo (API incompleta),
 * con carpeta abierta activamos el agent loop igual — evita respuestas con <tool_call> falsas.
 */
export function shouldUseAgentLoop(request: vscode.ChatRequest): boolean {
  if (isAgentMode(request)) {
    return true;
  }

  const extras = request as ChatRequestWithMode;
  if (extras.tools && extras.tools.size > 0) {
    return true;
  }

  const config = vscode.workspace.getConfiguration("editcore");
  if (!config.get<boolean>("agent.alwaysWhenWorkspaceOpen", true)) {
    return false;
  }

  return Boolean(vscode.workspace.workspaceFolders?.length);
}
