import * as vscode from "vscode";
import { createClaudeClient, mapClaudeApiError } from "./anthropicClient";
import { LLM_CONFIG } from "./llmConfig";
import { resolveClaudeModelId } from "./models";

const SECRET_KEY = "anthropicApiKey";
const OPENAI_SECRET_KEY = "openaiApiKey";
const OPENROUTER_SECRET_KEY = "openrouterApiKey";
const USAGE_KEY = "editcore.usageTotals";

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-opus-4-6": { input: 15, output: 75 },
  "claude-haiku-4-5": { input: 1, output: 5 },
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4.1": { input: 2, output: 8 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
};

function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const p = MODEL_PRICING[model] ?? MODEL_PRICING[LLM_CONFIG.claude.defaultModel];
  return (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output;
}

function normalizeApiKey(key?: string): string | undefined {
  if (!key) {
    return undefined;
  }
  const cleaned = key.replace(/[\uFEFF\u200B-\u200D]/g, "").trim();
  return cleaned || undefined;
}

function keyHint(key?: string): string {
  if (!key) {
    return "Sin configurar";
  }
  if (key.length <= 12) {
    return "********";
  }
  return `${key.slice(0, 7)}...${key.slice(-4)}`;
}

export interface UsageTotals {
  inputTokens: number;
  outputTokens: number;
  requestCount: number;
  estimatedCostUsd: number;
  toolCalls: Record<string, number>;
  toolCallsByRole: Record<string, number>;
}

export interface UsageSnapshot extends UsageTotals {
  sessionInputTokens: number;
  sessionOutputTokens: number;
  sessionRequestCount: number;
  sessionEstimatedCostUsd: number;
  sessionToolCalls: Record<string, number>;
  sessionToolCallsByRole: Record<string, number>;
  hasApiKey: boolean;
  apiKeyHint: string;
  hasOpenAiKey: boolean;
  openAiKeyHint: string;
  model: string;
  openAiModel: string;
  fallbackEnabled: boolean;
}

export class ApiKeyService {
  private sessionInput = 0;
  private sessionOutput = 0;
  private sessionRequests = 0;
  private sessionCost = 0;
  private sessionToolCalls: Record<string, number> = {};
  private sessionToolCallsByRole: Record<string, number> = {};

  private readonly _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange = this._onDidChange.event;

  constructor(private readonly context: vscode.ExtensionContext) {}

  async hasApiKey(): Promise<boolean> {
    return Boolean(await this.getApiKey());
  }

  async hasOpenAiKey(): Promise<boolean> {
    return Boolean(await this.getOpenAiKey());
  }

  async hasOpenRouterKey(): Promise<boolean> {
    return Boolean(await this.getOpenRouterKey());
  }

  async getOpenRouterKey(): Promise<string | undefined> {
    const key = await this.context.secrets.get(OPENROUTER_SECRET_KEY);
    return key?.trim() || undefined;
  }

  async saveOpenRouterKey(rawKey: string): Promise<void> {
    const key = rawKey.trim();
    if (!key) throw new Error("La API Key de OpenRouter no puede estar vacía.");
    await this.context.secrets.store(OPENROUTER_SECRET_KEY, key);
    this._onDidChange.fire();
  }

  async clearOpenRouterKey(): Promise<void> {
    await this.context.secrets.delete(OPENROUTER_SECRET_KEY);
    this._onDidChange.fire();
  }

  async hasAnyLlmKey(): Promise<boolean> {
    return (await this.hasApiKey()) || (await this.hasOpenAiKey()) || (await this.hasOpenRouterKey());
  }

  async getApiKey(): Promise<string | undefined> {
    const fromSecrets = await this.context.secrets.get(SECRET_KEY);
    return normalizeApiKey(fromSecrets);
  }

  async getOpenAiKey(): Promise<string | undefined> {
    const key = await this.context.secrets.get(OPENAI_SECRET_KEY);
    return normalizeApiKey(key);
  }

  async getOpenAiKeyHint(): Promise<string> {
    return keyHint(await this.getOpenAiKey());
  }

  async getApiKeyHint(): Promise<string> {
    return keyHint(await this.getApiKey());
  }

  /** Migración legacy: guarda sin validación remota ni popup. */
  async importApiKeyIfEmpty(provider: "anthropic" | "openai", rawKey: string): Promise<boolean> {
    const key = rawKey.trim();
    if (!key) {
      return false;
    }
    if (provider === "anthropic") {
      if (await this.hasApiKey()) {
        return false;
      }
      await this.context.secrets.store(SECRET_KEY, key);
      this._onDidChange.fire();
      return true;
    }
    if (await this.hasOpenAiKey()) {
      return false;
    }
    await this.context.secrets.store(OPENAI_SECRET_KEY, key);
    this._onDidChange.fire();
    return true;
  }

  async saveApiKey(rawKey: string): Promise<void> {
    const key = rawKey.trim();
    if (!key) {
      throw new Error("La API Key no puede estar vacia.");
    }
    if (!key.startsWith("sk-")) {
      throw new Error("Formato invalido. La key de Anthropic debe empezar con sk-");
    }
    await this.context.secrets.store(SECRET_KEY, key);
    try {
      await this.validateApiKey(key);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      vscode.window.showWarningMessage(`EditCore: Claude guardada, pero la validación falló: ${message}`);
    }
    this._onDidChange.fire();
  }

  async clearApiKey(): Promise<void> {
    await this.context.secrets.delete(SECRET_KEY);
    this._onDidChange.fire();
  }

  async saveOpenAiKey(rawKey: string): Promise<void> {
    const key = rawKey.trim();
    if (!key) {
      throw new Error("La API Key de OpenAI no puede estar vacia.");
    }
    if (!key.startsWith("sk-")) {
      throw new Error("Formato invalido. La key de OpenAI debe empezar con sk-");
    }
    await this.context.secrets.store(OPENAI_SECRET_KEY, key);
    try {
      const { validateOpenAiKey } = await import("./openaiClient");
      await validateOpenAiKey(key);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      vscode.window.showWarningMessage(`EditCore: OpenAI guardada, pero la validación falló: ${message}`);
    }
    this._onDidChange.fire();
  }

  async clearOpenAiKey(): Promise<void> {
    await this.context.secrets.delete(OPENAI_SECRET_KEY);
    this._onDidChange.fire();
  }

  async validateApiKey(apiKey: string): Promise<void> {
    const client = createClaudeClient(apiKey);
    const rawModel = vscode.workspace
      .getConfiguration("editcore")
      .get<string>("model", LLM_CONFIG.claude.defaultModel);
    const model = resolveClaudeModelId(rawModel);
    try {
      await client.messages.create({
        model,
        max_tokens: 16,
        messages: [{ role: "user", content: "ping" }],
      });
    } catch (err: unknown) {
      if ((err as { status?: number })?.status === 429) {
        return;
      }
      throw mapClaudeApiError(err);
    }
  }

  recordUsage(inputTokens: number, outputTokens: number): void {
    const model = vscode.workspace
      .getConfiguration("editcore")
      .get<string>("model", LLM_CONFIG.claude.defaultModel);
    const cost = estimateCostUsd(model, inputTokens, outputTokens);

    this.sessionInput += inputTokens;
    this.sessionOutput += outputTokens;
    this.sessionRequests += 1;
    this.sessionCost += cost;

    const totals = this.getTotals();
    totals.inputTokens += inputTokens;
    totals.outputTokens += outputTokens;
    totals.requestCount += 1;
    totals.estimatedCostUsd += cost;
    void this.context.globalState.update(USAGE_KEY, totals);
    this._onDidChange.fire();
  }

  recordToolCall(toolName: string, roleId?: string): void {
    this.sessionToolCalls[toolName] = (this.sessionToolCalls[toolName] ?? 0) + 1;
    const totals = this.getTotals();
    totals.toolCalls[toolName] = (totals.toolCalls[toolName] ?? 0) + 1;
    if (roleId) {
      this.sessionToolCallsByRole[roleId] = (this.sessionToolCallsByRole[roleId] ?? 0) + 1;
      totals.toolCallsByRole[roleId] = (totals.toolCallsByRole[roleId] ?? 0) + 1;
    }
    void this.context.globalState.update(USAGE_KEY, totals);
    this._onDidChange.fire();
  }

  getTotals(): UsageTotals {
    const stored = this.context.globalState.get<UsageTotals>(USAGE_KEY);
    if (!stored) {
      return {
        inputTokens: 0,
        outputTokens: 0,
        requestCount: 0,
        estimatedCostUsd: 0,
        toolCalls: {},
        toolCallsByRole: {},
      };
    }
    return { ...stored, toolCallsByRole: stored.toolCallsByRole ?? {} };
  }

  resetSessionUsage(): void {
    this.sessionInput = 0;
    this.sessionOutput = 0;
    this.sessionRequests = 0;
    this.sessionCost = 0;
    this.sessionToolCalls = {};
    this.sessionToolCallsByRole = {};
    this._onDidChange.fire();
  }

  async getSnapshot(): Promise<UsageSnapshot> {
    const totals = this.getTotals();
    const config = vscode.workspace.getConfiguration("editcore");
    return {
      ...totals,
      sessionInputTokens: this.sessionInput,
      sessionOutputTokens: this.sessionOutput,
      sessionRequestCount: this.sessionRequests,
      sessionEstimatedCostUsd: this.sessionCost,
      sessionToolCalls: { ...this.sessionToolCalls },
      sessionToolCallsByRole: { ...this.sessionToolCallsByRole },
      hasApiKey: await this.hasApiKey(),
      apiKeyHint: await this.getApiKeyHint(),
      hasOpenAiKey: await this.hasOpenAiKey(),
      openAiKeyHint: await this.getOpenAiKeyHint(),
      model: config.get<string>("model", LLM_CONFIG.claude.defaultModel),
      openAiModel: config.get<string>("openai.model", LLM_CONFIG.openai.defaultModel),
      fallbackEnabled: config.get<boolean>("fallback.enabled", true),
    };
  }
}
