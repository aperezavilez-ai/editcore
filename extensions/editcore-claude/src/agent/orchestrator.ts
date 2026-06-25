import Anthropic from '@anthropic-ai/sdk';
import * as vscode from 'vscode';
import { runAgentTask, AgentEvent } from './agentLoop';
import { AgentRoleId } from '../agents/roles';
import { createClaudeClient, mapClaudeApiError } from '../anthropicClient';
import { GPTPRO4ALL_CONFIG } from '../gptpro4all.config';

export type OrchestratorEvent =
  | { type: 'phase'; phase: 'plan' | 'execute' | 'review'; message: string }
  | AgentEvent;

/**
 * Orquestador v1: plan → ejecución agent → revisión breve.
 */
export async function runOrchestratedTask(
  apiKey: string,
  userTask: string,
  onEvent: (event: OrchestratorEvent) => void,
  abortSignal?: AbortSignal,
  onUsage?: (input: number, output: number) => void,
  onToolCall?: (name: string) => void,
  roleId: AgentRoleId = 'default'
): Promise<void> {
  const config = vscode.workspace.getConfiguration('editcore');
  const model = config.get<string>('model', GPTPRO4ALL_CONFIG.claude.defaultModel);
  const client = createClaudeClient(apiKey);

  onEvent({ type: 'phase', phase: 'plan', message: 'Generando plan de trabajo…' });

  let planText = '';
  try {
    const planRes = await client.messages.create(
      {
        model,
        max_tokens: 2048,
        system:
          'Sos el orquestador de EditCore. Generá un plan numerado (máx 8 pasos) para la tarea. ' +
          'Solo el plan, sin ejecutar nada. Sé concreto con archivos/comandos.',
        messages: [{ role: 'user', content: userTask }],
      },
      { signal: abortSignal }
    );
    onUsage?.(planRes.usage.input_tokens, planRes.usage.output_tokens);
    planText = planRes.content
      .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n');
    onEvent({ type: 'assistant_text', text: `## Plan\n\n${planText}\n\n---\n\n` });
  } catch (err: any) {
    onEvent({ type: 'error', message: mapClaudeApiError(err).message });
    return;
  }

  onEvent({ type: 'phase', phase: 'execute', message: 'Ejecutando plan…' });

  const executionTask = `Tarea original:\n${userTask}\n\nPlan aprobado:\n${planText}\n\nEjecutá el plan paso a paso usando las tools disponibles.`;

  await runAgentTask(
    apiKey,
    executionTask,
    (ev) => onEvent(ev),
    abortSignal,
    onUsage,
    onToolCall,
    roleId
  );

  onEvent({ type: 'phase', phase: 'review', message: 'Revisión final…' });

  try {
    const reviewRes = await client.messages.create(
      {
        model,
        max_tokens: 1024,
        system: 'Revisión final breve: qué se hizo, qué falta, riesgos. Máx 15 líneas.',
        messages: [{ role: 'user', content: `Tarea:\n${userTask}\n\nPlan:\n${planText}` }],
      },
      { signal: abortSignal }
    );
    onUsage?.(reviewRes.usage.input_tokens, reviewRes.usage.output_tokens);
    const review = reviewRes.content
      .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n');
    onEvent({ type: 'assistant_text', text: `\n\n## Revisión\n\n${review}\n` });
  } catch {
    // revisión opcional
  }
}
