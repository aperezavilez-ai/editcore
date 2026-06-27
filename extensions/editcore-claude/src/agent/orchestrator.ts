import Anthropic from '@anthropic-ai/sdk';
import * as vscode from 'vscode';
import { runAgentTask, AgentEvent } from './agentLoop';
import { AgentRoleId } from '../agents/roles';
import { createClaudeClient, mapClaudeApiError } from '../anthropicClient';
import { LLM_CONFIG } from '../llmConfig';
import { resolveClaudeModelId } from '../models';
import {
  parseStructuredPlan,
  formatPlanForDisplay,
  requestPlanApproval,
  savePlan,
  isPlanApprovalEnabled,
} from '../platform/planApproval';
import {
  runPostChangeValidation,
  saveValidationReport,
  formatValidationMarkdown,
  isPostChangeValidationEnabled,
} from '../platform/postChangeValidator';

export type OrchestratorEvent =
  | { type: 'phase'; phase: 'plan' | 'execute' | 'review' | 'validate'; message: string }
  | AgentEvent;

const PLAN_SYSTEM =
  'Sos el orquestador de EditCore. Generá un plan estructurado en Markdown con estas secciones:\n' +
  '## Objetivo\n## Plan (pasos numerados, máx 8)\n## Riesgos\n## Beneficios\n## Reversión\n' +
  'Sé concreto con archivos y comandos. No ejecutes nada, solo el plan.';

/**
 * Orquestador v1: plan → aprobación → ejecución agent → validación → revisión.
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
  const model = resolveClaudeModelId(config.get<string>('model', LLM_CONFIG.claude.defaultModel));
  const client = createClaudeClient(apiKey);
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

  onEvent({ type: 'phase', phase: 'plan', message: 'Generando plan de trabajo…' });

  let planText = '';
  try {
    const planRes = await client.messages.create(
      {
        model,
        max_tokens: 2048,
        system: PLAN_SYSTEM,
        messages: [{ role: 'user', content: userTask }],
      },
      { signal: abortSignal }
    );
    onUsage?.(planRes.usage.input_tokens, planRes.usage.output_tokens);
    planText = planRes.content
      .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n');
    onEvent({ type: 'assistant_text', text: `${formatPlanForDisplay(parseStructuredPlan(planText, userTask))}\n\n---\n\n` });
  } catch (err: any) {
    onEvent({ type: 'error', message: mapClaudeApiError(err).message });
    return;
  }

  const structuredPlan = parseStructuredPlan(planText, userTask);
  if (workspaceRoot) {
    await savePlan(structuredPlan, workspaceRoot).catch(() => undefined);
  }

  if (isPlanApprovalEnabled()) {
    const approval = await requestPlanApproval(structuredPlan);
    if (approval === 'rejected') {
      onEvent({ type: 'assistant_text', text: '\n_Plan rechazado. No se ejecutó ningún cambio._\n' });
      onEvent({ type: 'done', reason: 'finished' });
      return;
    }
    if (approval === 'edit') {
      onEvent({
        type: 'assistant_text',
        text: '\n_Editá el plan en el chat y volvé a enviar la tarea._\n',
      });
      onEvent({ type: 'done', reason: 'finished' });
      return;
    }
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

  if (isPostChangeValidationEnabled()) {
    onEvent({ type: 'phase', phase: 'validate', message: 'Validando build y tests…' });
    const validation = await runPostChangeValidation();
    if (validation) {
      await saveValidationReport(validation).catch(() => undefined);
      onEvent({
        type: 'assistant_text',
        text: `\n\n## Validación\n\n${formatValidationMarkdown(validation)}\n`,
      });
    }
  }

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
