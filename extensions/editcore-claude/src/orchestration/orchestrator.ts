/**
 * EditCore Orchestration Engine — middleware de backend (sin UI).
 * Gestiona selección de modelo, tokens y conexión a Qdrant según .cursorrules.
 *
 * Uso:
 *   import { Orchestrator, select_model, estimateTokens } from "../orchestrator";
 */

// ---------------------------------------------------------------------------
// Modelos (reglas .cursorrules)
// ---------------------------------------------------------------------------

export const ORCHESTRATOR_MODELS = {
  CLAUDE_SONNET: "claude-3-5-sonnet",
  GPT4O: "gpt-4o",
} as const;

export type OrchestratorModelId =
  (typeof ORCHESTRATOR_MODELS)[keyof typeof ORCHESTRATOR_MODELS];

export type OrchestratorProvider = "anthropic" | "openai";

export interface ModelRoute {
  model: OrchestratorModelId;
  provider: OrchestratorProvider;
  reason: string;
}

/** Palabras clave de tarea que fuerzan Claude (sección 2, .cursorrules). */
const SONNET_TASK_PATTERNS = [
  "architect",
  "refactor structure",
  "new feature",
] as const;

const DEFAULT_CONTEXT_LIMIT = 8_000;
const DEFAULT_RAG_TOP_K = 8;
const DEFAULT_RECENT_MESSAGE_KEEP = 6;

// ---------------------------------------------------------------------------
// select_model — router dinámico (.cursorrules §2)
// ---------------------------------------------------------------------------

function taskRequiresSonnet(task: string): boolean {
  const lower = task.toLowerCase();
  return SONNET_TASK_PATTERNS.some((pattern) => lower.includes(pattern));
}

/**
 * Selecciona el modelo según tipo de tarea y peso de contexto.
 * - Tarea arquitectura / refactor estructural / feature nueva → Claude Sonnet
 * - token_count > 8000 → Claude Sonnet
 * - En otro caso → GPT-4o
 */
export function select_model(task: string, token_count: number): ModelRoute {
  if (taskRequiresSonnet(task)) {
    return {
      model: ORCHESTRATOR_MODELS.CLAUDE_SONNET,
      provider: "anthropic",
      reason: "task_classification: architect | refactor structure | new feature",
    };
  }

  if (token_count > DEFAULT_CONTEXT_LIMIT) {
    return {
      model: ORCHESTRATOR_MODELS.CLAUDE_SONNET,
      provider: "anthropic",
      reason: `context_weight: token_count ${token_count} > ${DEFAULT_CONTEXT_LIMIT}`,
    };
  }

  return {
    model: ORCHESTRATOR_MODELS.GPT4O,
    provider: "openai",
    reason: "default: task within context budget",
  };
}

// ---------------------------------------------------------------------------
// Token efficiency (.cursorrules §3)
// ---------------------------------------------------------------------------

export interface ChatTurn {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface RagChunk {
  id: string;
  path: string;
  text: string;
  score?: number;
}

export interface TokenBudget {
  estimated: number;
  limit: number;
  pruned: boolean;
}

/** Estimación rápida pre-llamada (~4 caracteres por token). */
export function estimateTokens(input: string | string[] | ChatTurn[]): number {
  if (typeof input === "string") {
    return Math.max(1, Math.ceil(input.length / 4));
  }
  if (Array.isArray(input) && input.length > 0 && typeof input[0] === "string") {
    return (input as string[]).reduce((sum, s) => sum + estimateTokens(s), 0);
  }
  return (input as ChatTurn[]).reduce(
    (sum, turn) => sum + estimateTokens(turn.content),
    0
  );
}

export interface PruneContextInput {
  history: ChatTurn[];
  ragChunks: RagChunk[];
  tokenLimit?: number;
  recentKeep?: number;
  maxRagChunks?: number;
}

export interface PrunedContext {
  history: ChatTurn[];
  ragChunks: RagChunk[];
  tokens_estimated: number;
  pruned: boolean;
  summary: string;
}

/**
 * Context pruning: historial reciente + chunks RAG más relevantes si se supera el límite.
 */
export function pruneContext(input: PruneContextInput): PrunedContext {
  const limit = input.tokenLimit ?? DEFAULT_CONTEXT_LIMIT;
  const recentKeep = input.recentKeep ?? DEFAULT_RECENT_MESSAGE_KEEP;
  const maxRag = input.maxRagChunks ?? DEFAULT_RAG_TOP_K;

  const sortedRag = [...input.ragChunks]
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, maxRag);

  let history = [...input.history];
  let rag = sortedRag;
  let tokens = estimateTokens([
    ...history.map((h) => h.content),
    ...rag.map((c) => c.text),
  ]);

  if (tokens <= limit) {
    return {
      history,
      ragChunks: rag,
      tokens_estimated: tokens,
      pruned: false,
      summary: "context within limit",
    };
  }

  history = history.slice(-recentKeep);
  tokens = estimateTokens([
    ...history.map((h) => h.content),
    ...rag.map((c) => c.text),
  ]);

  while (tokens > limit && rag.length > 1) {
    rag = rag.slice(0, -1);
    tokens = estimateTokens([
      ...history.map((h) => h.content),
      ...rag.map((c) => c.text),
    ]);
  }

  while (tokens > limit && history.length > 1) {
    history = history.slice(1);
    tokens = estimateTokens([
      ...history.map((h) => h.content),
      ...rag.map((c) => c.text),
    ]);
  }

  return {
    history,
    ragChunks: rag,
    tokens_estimated: tokens,
    pruned: true,
    summary: `pruned to ${history.length} messages and ${rag.length} rag chunks (~${tokens} tokens)`,
  };
}

// ---------------------------------------------------------------------------
// Qdrant — almacén vectorial (.cursorrules §1, §4)
// ---------------------------------------------------------------------------

export interface QdrantConfig {
  url: string;
  apiKey?: string;
  collection: string;
  timeoutMs?: number;
}

export interface QdrantPoint {
  id: string | number;
  vector: number[];
  payload?: Record<string, unknown>;
}

export interface QdrantSearchHit {
  id: string | number;
  score: number;
  payload: Record<string, unknown>;
}

export class QdrantConnection {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;
  private readonly collection: string;
  private readonly timeoutMs: number;

  constructor(config: QdrantConfig) {
    this.baseUrl = config.url.replace(/\/$/, "");
    this.collection = config.collection;
    this.timeoutMs = config.timeoutMs ?? 15_000;
    this.headers = { "Content-Type": "application/json" };
    if (config.apiKey) {
      this.headers["api-key"] = config.apiKey;
    }
  }

  async ping(): Promise<boolean> {
    try {
      await this.request("GET", `/collections/${encodeURIComponent(this.collection)}`);
      return true;
    } catch {
      return false;
    }
  }

  async ensureCollection(vectorSize: number): Promise<void> {
    try {
      await this.request("GET", `/collections/${encodeURIComponent(this.collection)}`);
    } catch {
      await this.request("PUT", `/collections/${encodeURIComponent(this.collection)}`, {
        vectors: { size: vectorSize, distance: "Cosine" },
      });
    }
  }

  async upsert(points: QdrantPoint[]): Promise<void> {
    if (points.length === 0) return;
    await this.request(
      "PUT",
      `/collections/${encodeURIComponent(this.collection)}/points?wait=true`,
      { points }
    );
  }

  async search(vector: number[], limit = DEFAULT_RAG_TOP_K): Promise<QdrantSearchHit[]> {
    const body = {
      vector,
      limit,
      with_payload: true,
    };
    const data = (await this.request(
      "POST",
      `/collections/${encodeURIComponent(this.collection)}/points/search`,
      body
    )) as { result?: Array<{ id: string | number; score: number; payload?: Record<string, unknown> }> };

    return (data.result ?? []).map((hit) => ({
      id: hit.id,
      score: hit.score,
      payload: hit.payload ?? {},
    }));
  }

  private async request(method: string, path: string, body?: unknown): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: this.headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Qdrant ${method} ${path} → ${res.status}: ${text.slice(0, 300)}`);
      }
      if (res.status === 204) return {};
      return res.json();
    } finally {
      clearTimeout(timer);
    }
  }
}

function hitsToRagChunks(hits: QdrantSearchHit[]): RagChunk[] {
  return hits.map((hit) => ({
    id: String(hit.id),
    path: String(hit.payload.path ?? hit.payload.file ?? "unknown"),
    text: String(hit.payload.text ?? hit.payload.content ?? ""),
    score: hit.score,
  }));
}

// ---------------------------------------------------------------------------
// Respuesta estructurada (.cursorrules §3)
// ---------------------------------------------------------------------------

export interface OrchestratorResult {
  model_used: OrchestratorModelId;
  tokens_estimated: number;
  diff: string;
  provider: OrchestratorProvider;
  route_reason: string;
  pruned: boolean;
  rag_chunks: RagChunk[];
  context_summary: string;
}

export interface OrchestratorPrepareInput {
  task: string;
  history?: ChatTurn[];
  /** Texto o consulta para recuperar contexto en Qdrant. Por defecto usa `task`. */
  retrievalQuery?: string;
  tokenLimit?: number;
}

export interface OrchestratorDeps {
  /** Genera el embedding de la consulta (inyectado por el servicio consumidor). */
  embedQuery: (text: string) => Promise<number[]>;
  qdrant: QdrantConnection;
}

// ---------------------------------------------------------------------------
// Orchestrator — pipeline de ejecución (.cursorrules §4, pasos 1–3)
// ---------------------------------------------------------------------------

export class Orchestrator {
  constructor(private readonly deps: OrchestratorDeps) {}

  /**
   * Pipeline invisible:
   * 1. Recuperar código relevante desde Qdrant
   * 2. Estimar tokens (+ pruning si hace falta)
   * 3. Ejecutar select_model
   *
   * La generación de parches y validación LSP quedan en los servicios que importen este módulo.
   */
  async prepare(input: OrchestratorPrepareInput): Promise<OrchestratorResult> {
    const history = input.history ?? [];
    const query = input.retrievalQuery ?? input.task;

    let ragChunks: RagChunk[] = [];
    try {
      const vector = await this.deps.embedQuery(query);
      const hits = await this.deps.qdrant.search(vector);
      ragChunks = hitsToRagChunks(hits);
    } catch {
      ragChunks = [];
    }

    const pruned = pruneContext({
      history,
      ragChunks,
      tokenLimit: input.tokenLimit ?? DEFAULT_CONTEXT_LIMIT,
    });

    const taskTokens = estimateTokens(input.task);
    const totalTokens = pruned.tokens_estimated + taskTokens;
    const route = select_model(input.task, totalTokens);

    return {
      model_used: route.model,
      tokens_estimated: totalTokens,
      diff: "",
      provider: route.provider,
      route_reason: route.reason,
      pruned: pruned.pruned,
      rag_chunks: pruned.ragChunks,
      context_summary: pruned.summary,
    };
  }

  /** Serializa el resultado al JSON exigido por .cursorrules §3. */
  static toStructuredJson(result: OrchestratorResult): string {
    return JSON.stringify({
      model_used: result.model_used,
      tokens_estimated: result.tokens_estimated,
      diff: result.diff,
    });
  }

  /** Actualiza `diff` tras que un servicio genere el parche de código. */
  static withDiff(result: OrchestratorResult, diff: string): OrchestratorResult {
    return { ...result, diff };
  }
}

// ---------------------------------------------------------------------------
// Factory — configuración desde entorno (reutilizable en servicios)
// ---------------------------------------------------------------------------

export interface OrchestratorEnvConfig {
  qdrantUrl?: string;
  qdrantApiKey?: string;
  qdrantCollection?: string;
}

export function createQdrantFromEnv(
  env: OrchestratorEnvConfig = process.env as OrchestratorEnvConfig
): QdrantConnection {
  const url = env.qdrantUrl ?? process.env.QDRANT_URL ?? "http://127.0.0.1:6333";
  const apiKey = env.qdrantApiKey ?? process.env.QDRANT_API_KEY;
  const collection =
    env.qdrantCollection ?? process.env.QDRANT_COLLECTION ?? "editcore_code";
  return new QdrantConnection({ url, apiKey, collection });
}

export function createOrchestrator(
  deps: Partial<OrchestratorDeps> & Pick<OrchestratorDeps, "embedQuery">
): Orchestrator {
  return new Orchestrator({
    qdrant: deps.qdrant ?? createQdrantFromEnv(),
    embedQuery: deps.embedQuery,
  });
}
