import Anthropic from '@anthropic-ai/sdk';
import * as vscode from 'vscode';
import { ApiKeyService } from '../apiKeyService';
import { runAgentTask, AgentEvent } from './agentLoop';
import { AgentRoleId } from '../agents/roles';
import { createClaudeClient, mapClaudeApiError } from '../anthropicClient';
import { LLM_CONFIG } from '../llmConfig';
import { resolveClaudeModelId } from '../models';
import {
  EDITCORE_AGENT_PIPELINE,
  formatPipelineStepContext,
  getPipelineForTask,
  type PipelineAgentStep,
} from '../orchestration/agentPipeline';
import { recordAgentTrace } from '../memory/memoryManager';
import {
  runPostChangeValidation,
  saveValidationReport,
  formatValidationMarkdown,
  isPostChangeValidationEnabled,
} from '../platform/postChangeValidator';
import {
  collectGitChanges,
  formatChangeReportMarkdown,
  writeChangeReport,
} from '../evolution/changeReportGenerator';
import { buildQaChecklistMarkdown, writeQaChecklist } from '../evolution/qaChecklistGenerator';

export type MultiAgentEvent =
  | { type: 'phase'; phase: string; agent: AgentRoleId; message: string }
  | AgentEvent;

/**
 * Multiagente v3: pipeline Architect → Coder → Reviewer → QA → Prompt Engineer.
 * Memoria compartida por contexto acumulado + trazas en .editcore/memory/agent-traces.jsonl.
 */
export async function runMultiAgentPipeline(
  apiKey: string,
  userTask: string,
  onEvent: (event: MultiAgentEvent) => void,
  abortSignal?: AbortSignal,
  onUsage?: (input: number, output: number) => void,
  onToolCall?: (name: string) => void,
  apiKeyService?: ApiKeyService
): Promise<void> {
  let sharedContext = `Tarea del usuario:\n${userTask}\n`;
  const config = vscode.workspace.getConfiguration('editcore');
  const model = resolveClaudeModelId(config.get<string>('model', LLM_CONFIG.claude.defaultModel));
  const client = createClaudeClient(apiKey);
  const pipeline = getPipelineForTask(userTask);
  const agentsRun: string[] = [];

  for (const step of pipeline) {
    if (abortSignal?.aborted) {
      onEvent({ type: 'done', reason: 'cancelled' });
      return;
    }

    agentsRun.push(step.label);
    onEvent({
      type: 'phase',
      phase: step.label,
      agent: step.role,
      message: `${step.label} (${step.preferredProvider}/${step.preferredModel})…`,
    });

    const stepTask = formatPipelineStepContext(step, sharedContext);
    let stepOutput = '';

    if (step.usesTools) {
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
      step.role,
      apiKeyService
    );
    } else {
      try {
        const res = await client.messages.create(
          {
            model,
            max_tokens: 2000,
            system: `Sos ${step.label} de EditCore. ${step.instruction}`,
            messages: [{ role: 'user', content: stepTask }],
          },
          { signal: abortSignal }
        );
        onUsage?.(res.usage.input_tokens, res.usage.output_tokens);
        stepOutput = res.content
          .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('\n');
        onEvent({ type: 'assistant_text', text: stepOutput });
      } catch (err: unknown) {
        const message = err instanceof Error ? mapClaudeApiError(err).message : String(err);
        stepOutput = `_Error en ${step.label}: ${message}_`;
        onEvent({ type: 'assistant_text', text: stepOutput });
      }
    }

    await recordAgentTrace(step.label, step.instruction, stepOutput.slice(0, 2000), stepOutput.length > 0);
    sharedContext += `\n\n## Salida de ${step.label}\n${stepOutput.slice(0, 4000)}`;
  }

  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (root && config.get<boolean>('evolution.generateReportsAfterPipeline', true)) {
    try {
      const git = await collectGitChanges(root);
      const report = formatChangeReportMarkdown(git, { agents: agentsRun });
      await writeChangeReport(root, report);
      const qa = buildQaChecklistMarkdown({ gitClean: git.unstaged.length === 0 });
      await writeQaChecklist(root, qa);
      onEvent({
        type: 'assistant_text',
        text: '\n\n_Reportes guardados en `.editcore/docs/` y `.editcore/reports/`._\n',
      });
    } catch {
      // opcional
    }
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

export { EDITCORE_AGENT_PIPELINE, type PipelineAgentStep };
