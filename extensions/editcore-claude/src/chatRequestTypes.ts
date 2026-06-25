import * as vscode from "vscode";

/** Campos de modo expuestos por EditCore (proposal chatParticipantAdditions). */
export interface ChatRequestModeInstructions {
  readonly name: string;
  readonly isBuiltin?: boolean;
}

export type ChatRequestWithMode = vscode.ChatRequest & {
  readonly modeInstructions2?: ChatRequestModeInstructions;
};

export function isAgentMode(request: vscode.ChatRequest): boolean {
  const mode = (request as ChatRequestWithMode).modeInstructions2;
  if (!mode?.name) {
    return false;
  }

  const name = mode.name.toLowerCase();
  if (name === "ask" || name === "edit") {
    return false;
  }
  if (name === "agent") {
    return true;
  }

  // Modos personalizados tipo agente (no Ask/Edit)
  return mode.isBuiltin === false;
}
