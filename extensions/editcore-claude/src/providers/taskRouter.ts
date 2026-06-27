import * as vscode from "vscode";
import { ChatMessage } from "../anthropicClient";
import { CLAUDE_MODELS } from "../models";
import { estimateTokens, select_model } from "../orchestration/orchestrator";
import { chatMessagesToTurns } from "../orchestration/orchestratorInvoke";

export type TaskCategory =
  | "architecture"
  | "coding"
  | "optimization"
  | "search"
  | "bulk"
  | "local"
  | "general";

export interface TaskRoutingRule {
  category: TaskCategory;
  provider: "anthropic" | "openai" | "openrouter" | "ollama";
  model: string;
  keywords: string[];
}

const DEFAULT_RULES: TaskRoutingRule[] = [
  {
    category: "architecture",
    provider: "openai",
    model: "gpt-4o",
    keywords: ["arquitectura", "architecture", "diseño", "design system", "adr"],
  },
  {
    category: "coding",
    provider: "anthropic",
    model: "claude-sonnet-4-6",
    keywords: ["implement", "código", "code", "fix", "bug", "refactor"],
  },
  {
    category: "optimization",
    provider: "openai",
    model: "gpt-4o",
    keywords: ["optimiz", "performance", "rendimiento", "latency"],
  },
  {
    category: "bulk",
    provider: "openrouter",
    model: "deepseek/deepseek-chat",
    keywords: ["masivo", "bulk", "batch", "migrar miles"],
  },
  {
    category: "local",
    provider: "ollama",
    model: "llama3.2",
    keywords: ["local", "offline", "ollama", "privado"],
  },
];

export function classifyTask(text: string): TaskCategory {
  const lower = text.toLowerCase();
  for (const rule of DEFAULT_RULES) {
    if (rule.keywords.some((k) => lower.includes(k))) return rule.category;
  }
  return "general";
}

function resolveOrchestratorTaskRoute(
  text: string,
  messages?: ChatMessage[]
): TaskRoutingRule | undefined {
  const config = vscode.workspace.getConfiguration("editcore");
  if (!config.get<boolean>("orchestrator.enabled", true)) {
    return undefined;
  }

  try {
    const turns = messages ? chatMessagesToTurns(messages) : [];
    const tokenCount = estimateTokens([text, ...turns.map((t) => t.content)]);
    const route = select_model(text, tokenCount);
    return {
      category: classifyTask(text),
      provider: route.provider,
      model: route.provider === "openai" ? "gpt-4o" : CLAUDE_MODELS[0].id,
      keywords: [],
    };
  } catch {
    return undefined;
  }
}

function resolveLegacyKeywordRoute(text: string): TaskRoutingRule | undefined {
  const config = vscode.workspace.getConfiguration("editcore");
  if (!config.get<boolean>("router.autoSelect", false)) {
    return undefined;
  }

  const category = classifyTask(text);
  if (category === "general") return undefined;

  const customRules = config.get<TaskRoutingRule[]>("router.rules", []);
  const rules = customRules.length ? customRules : DEFAULT_RULES;
  return rules.find((r) => r.category === category);
}

export function resolveTaskRoute(
  text: string,
  messages?: ChatMessage[]
): TaskRoutingRule | undefined {
  const orchestrated = resolveOrchestratorTaskRoute(text, messages);
  if (orchestrated) {
    return orchestrated;
  }
  return resolveLegacyKeywordRoute(text);
}

export function describeRoute(rule: TaskRoutingRule): string {
  return `${rule.category} → ${rule.provider}/${rule.model}`;
}
