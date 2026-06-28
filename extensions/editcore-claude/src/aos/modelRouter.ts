/**
 * Selección inteligente de modelo — Fase 9 (Prompt 3).
 */
import * as vscode from "vscode";
import type { AgentRoleId } from "../agents/roles";
import { LLM_CONFIG } from "../llmConfig";
import { resolveClaudeModelId } from "../models";
import { classifyTask } from "../providers/taskRouter";
import type { ModelRouteDecision } from "./types";
import { AGENT_OS_REGISTRY } from "./agentRegistry";

const CLAUDE_ARCHITECTURE_ROLES: AgentRoleId[] = [
  "architect",
  "reviewer",
  "debug",
  "qa",
  "security",
  "prompt_engineer",
  "cto",
];

const OPENAI_CODE_ROLES: AgentRoleId[] = ["fullstack", "documenter", "devops", "saas"];

export function resolveModelForAgent(
  roleId: AgentRoleId,
  taskHint?: string
): ModelRouteDecision {
  const agent = AGENT_OS_REGISTRY.find((a) => a.id === roleId);
  const config = vscode.workspace.getConfiguration("editcore");
  const overrideProvider = config.get<string>("aos.modelOverride", "auto");

  if (overrideProvider === "anthropic" || overrideProvider === "openai") {
    const provider = overrideProvider as "anthropic" | "openai";
    return {
      provider,
      model:
        provider === "openai"
          ? config.get<string>("openai.model", LLM_CONFIG.openai.defaultModel)
          : resolveClaudeModelId(config.get<string>("model", LLM_CONFIG.claude.defaultModel)),
      reason: "override usuario",
    };
  }

  if (agent) {
    return {
      provider: agent.preferredProvider,
      model: agent.preferredModel,
      reason: "registro AOS",
    };
  }

  if (OPENAI_CODE_ROLES.includes(roleId)) {
    return {
      provider: "openai",
      model: config.get<string>("openai.model", LLM_CONFIG.openai.defaultModel),
      reason: "rol código",
    };
  }

  if (CLAUDE_ARCHITECTURE_ROLES.includes(roleId)) {
    return {
      provider: "anthropic",
      model: resolveClaudeModelId(config.get<string>("model", LLM_CONFIG.claude.defaultModel)),
      reason: "rol análisis",
    };
  }

  if (taskHint) {
    const category = classifyTask(taskHint);
    if (category === "optimization" || category === "coding") {
      return {
        provider: "openai",
        model: config.get<string>("openai.model", LLM_CONFIG.openai.defaultModel),
        reason: "clasificación tarea: " + category,
      };
    }
  }

  return {
    provider: "anthropic",
    model: resolveClaudeModelId(config.get<string>("model", LLM_CONFIG.claude.defaultModel)),
    reason: "default Claude",
  };
}

export function detectTaskIntent(task: string): import("./types").TaskIntent {
  const lower = task.toLowerCase();
  if (/arquitect|diseñ|design|adr|estructur/.test(lower)) return "architecture";
  if (/implement|crear|código|code|feature|fix/.test(lower)) return "implement";
  if (/revis|review|audit/.test(lower)) return "review";
  if (/debug|error|bug|falla|crash/.test(lower)) return "debug";
  if (/test|qa|prueba|regresi/.test(lower)) return "test";
  if (/document|readme|manual/.test(lower)) return "document";
  if (/evoluc|mejora|autonom|roadmap/.test(lower)) return "evolve";
  return "general";
}
