/**
 * Puente para wire validateGeneration (autocrítica) al orchestrator middleware.
 */
import { ApiKeyService } from "../apiKeyService";
import { createClaudeClient } from "../anthropicClient";
import { resolveClaudeModelId } from "../models";
import type { ValidationLlmCaller } from "./orchestrator";

const VALIDATOR_MODEL = "claude-haiku-4-5";

export function createValidationCaller(apiKeyService: ApiKeyService): ValidationLlmCaller {
  return async (_model: string, systemPrompt: string, code: string): Promise<string> => {
    const apiKey = await apiKeyService.getApiKey();
    if (!apiKey?.trim()) {
      throw new Error("Sin API key para validación");
    }
    const client = createClaudeClient(apiKey);
    const model = resolveClaudeModelId(VALIDATOR_MODEL);
    const response = await client.messages.create({
      model,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Revisa este código generado:\n\n\`\`\`\n${code.slice(0, 12000)}\n\`\`\``,
        },
      ],
    });
    return response.content
      .filter((b): b is { type: "text"; text: string } => b.type === "text")
      .map((b) => b.text)
      .join("\n");
  };
}

export function isSelfCritiqueAvailable(apiKeyService: ApiKeyService): boolean {
  return Boolean(apiKeyService);
}
