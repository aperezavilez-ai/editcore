import Anthropic from '@anthropic-ai/sdk';
import * as vscode from 'vscode';
import { runAgentTask, AgentEvent } from './agentLoop';
import { AgentRoleId } from '../agents/roles';
import { createClaudeClient, mapClaudeApiError } from '../anthropicClient';
import { LLM_CONFIG } from '../llmConfig';
import { resolveClaudeModelId } from '../models';
import {
  runPostChangeValidation,
  saveValidationReport,
  formatValidationMarkdown,
  isPostChangeValidationEnabled,
} from '../platform/postChangeValidator';

export type MultiAgentEvent =
  | { type: 'phase'; phase: string; agent: AgentRoleId; message: string }
  | AgentEvent;

interface AgentStep {
  role: AgentRoleId;
  label: string;
  instruction: string;
}

const PIPELINE: AgentStep[] = [
  {
    role: 'architect',
    label: 'Arquitecto',
    instruction: 'Diseñá la solución: arquitectura, archivos a tocar, riesgos. No implementes aún.',
  },
  {
    role: 'fullstack',
    label: 'Programador',
    instruction: 'Implementá según el diseño del arquitecto. Usá las tools disponibles.',
  },
  {
    role: 'qa',
    label: 'QA',
    instruction: 'Revisá lo implementado: bugs, casos borde, tests faltantes. Corregí si es crítico.',
  },
  {
    role: 'devops',
    label: 'DevOps',
    instruction: 'Verificá build, deploy readiness, variables de entorno y CI. Resume estado.',
  },
];

/**
 * Multiagente v2: pipeline secuencial con handoffs entre roles especializados.
 */
export async function runMultiAgentPipeline(
  apiKey: string,
  userTask: string,
  onEvent: (event: MultiAgentEvent) => void,
  abortSignal?: AbortSignal,
  onUsage?: (input: number, output: number) => void,
  onToolCall?: (name: string) => void
): Promise<void> {
  let context = `Tarea del usuario:\n${userTask}\n`;
  const config = vscode.workspace.getConfiguration('editcore');
  const model = resolveClaudeModelId(config.get<string>('model', LLM_CONFIG.claude.defaultModel));
  const client = createClaudeClient(apiKey);

  for (const step of PIPELINE) {
    if (abortSignal?.aborted) {
      onEvent({ type: 'done', reason: 'cancelled' });
      return;
    }

    onEvent({
      type: 'phase',
      phase: step.label,
      agent: step.role,
      message: `${step.label} trabajando…`,
    });

    const stepTask = `${context}\n\n## Rol actual: ${step.label}\n${step.instruction}`;

    let stepOutput = '';
    await runAgentTask(
      apiKey,
      stepTask,
      (ev) => {
        if (ev.type === 'assistant_text') stepOutput += ev.text;
        onEvent(ev);
      },
      abortSignal,
      onUsage,
      onToolCall,
      step.role
    );

    context += `\n\n## Salida de ${step.label}\n${stepOutput.slice(0, 4000)}`;
  }

  onEvent({ type: 'phase', phase: 'Documentador', agent: 'default', message: 'Generando resumen final…' });

  try {
    const docRes = await client.messages.create(
      {
        model,
        max_tokens: 1500,
        system: 'Sos el documentador de EditCore. Generá README/changelog breve de lo hecho.',
        messages: [{ role: 'user', content: context }],
      },
      { signal: abortSignal }
    );
    onUsage?.(docRes.usage.input_tokens, docRes.usage.output_tokens);
    const doc = docRes.content
      .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n');
    onEvent({ type: 'assistant_text', text: `\n\n## Documentación\n\n${doc}\n` });
  } catch {
    // opcional
  }

  if (isPostChangeValidationEnabled()) {
    onEvent({ type: 'phase', phase: 'Validación', agent: 'qa', message: 'Validando proyecto…' });
    const validation = await runPostChangeValidation();
    if (validation) {
      await saveValidationReport(validation).catch(() => undefined);
      onEvent({ type: 'assistant_text', text: `\n\n## Validación\n\n${formatValidationMarkdown(validation)}\n` });
    }
  }

  onEvent({ type: 'done', reason: 'finished' });
}

export function isMultiAgentEnabled(): boolean {
  return vscode.workspace.getConfiguration('editcore').get<boolean>('multiAgent.enabled', false);
}
