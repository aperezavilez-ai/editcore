import * as vscode from 'vscode';
import { ApiKeyService } from '../apiKeyService';
import { createClaudeClient } from '../anthropicClient';
import { GPTPRO4ALL_CONFIG } from '../gptpro4all.config';
import { getSessionStore } from './agentSessionStore';

export async function enrichSessionSummary(
  apiKey: string,
  apiKeyService: ApiKeyService,
  sessionId: string,
  task: string,
  assistantOutput: string
): Promise<void> {
  const enabled = vscode.workspace
    .getConfiguration('editcore')
    .get<boolean>('sessions.autoSummary', true);
  if (!enabled || assistantOutput.trim().length < 80) {
    return;
  }

  const client = createClaudeClient(apiKey);
  const model = GPTPRO4ALL_CONFIG.claude.defaultModel;

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 220,
      messages: [
        {
          role: 'user',
          content:
            `Resumí esta sesión de agente de código en 2-4 oraciones en español. ` +
            `Incluí qué se hizo, qué quedó pendiente y próximo paso concreto.\n\n` +
            `Tarea original:\n${task.slice(0, 600)}\n\n` +
            `Salida del agente:\n${assistantOutput.slice(0, 3500)}`,
        },
      ],
    });

    const block = response.content.find((b) => b.type === 'text');
    const text = block && block.type === 'text' ? block.text.trim() : '';
    if (!text) return;

    await getSessionStore().update(sessionId, { summary: text });
    apiKeyService.recordUsage(response.usage.input_tokens, response.usage.output_tokens);
  } catch {
    // resumen opcional — no bloquear al usuario
  }
}
