import type { ChatMessage } from "../anthropicClient";
import { getWorkspaceContextBlock } from "./workspaceContext";

/** Prefija mensajes con el resumen del workspace abierto (Claude y OpenAI). */
export async function prependWorkspaceContext(
  messages: ChatMessage[]
): Promise<ChatMessage[]> {
  const workspace = await getWorkspaceContextBlock();
  if (!workspace) {
    return messages;
  }

  const primer = messages[0];
  if (
    primer?.role === "user" &&
    primer.content.includes("=== WORKSPACE ABIERTO EN EDITCORE ===")
  ) {
    return messages;
  }

  return [
    {
      role: "user",
      content: `${workspace}\n\nUsa esta información del proyecto abierto. No pidas al usuario que comparta archivos manualmente.`,
    },
    {
      role: "assistant",
      content: "Entendido. Trabajaré con el proyecto abierto en EditCore.",
    },
    ...messages,
  ];
}
