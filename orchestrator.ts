/**
 * EditCore Orchestration Engine — middleware de backend (sin UI).
 * Gestiona selección de modelo, tokens, Qdrant y telemetría según .cursorrules.
 */

import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname, join } from "path";

// ---------------------------------------------------------------------------
// Modelos (reglas .cursorrules)
// ---------------------------------------------------------------------------

export const ORCHESTRATOR_MODELS = {
  CLAUDE_SONNET: "claude-3-5-sonnet",
  GPT4O: "gpt-4o",
} as const;

/** Modelo de validación (Self-Healing / Autocrítica). */
export const SELF_CRITIQUE_MODEL = "composer-2.5-fast";
export const SELF_CRITIQUE_MODEL_LABEL = "Composer 2.5 Fast";

/** Etiquetas de telemetría (costos / rendimiento). */
export type TelemetryModelLabel =
  | "Opus 4.8 High"
  | "Sonnet 4.6 Medium"
  | "Composer 2.5 Fast";

export type SelfCritiqueTelemetryStatus =
  | "success"
  | "corrected"
  | "skipped"
  | "failed";

const OPUS_TOKEN_THRESHOLD = 12_000;
const DEFAULT_STATS_FILE = ".editcore/stats.json";

const SELF_CRITIQUE_PROMPT =
  "Analiza este código buscando errores de sintaxis, vulnerabilidades de seguridad o fallos de lógica. " +
  "Si encuentras algún problema, propón la corrección inmediata. " +
  "Si no encuentras nada, confirma que el código es válido.";

const DEFAULT_VALIDATION_TIMEOUT_MS = 20_000;

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
  "arquitectura",
  "auditoría",
  "auditoria",
  "refactor structure",
  "refactor",
  "new feature",
  "nueva feature",
  "diseño",
] as const;

const DEFAULT_CONTEXT_LIMIT = 8_000;
/** Límite de tokens para contexto RAG inyectado al prompt (antes de select_model). */
export const RAG_CONTEXT_TOKEN_LIMIT = 4_000;
export const DEFAULT_QDRANT_COLLECTION = "editcore_code";
export const DEFAULT_RAG_TOP_K = 8;
export const DEFAULT_RECENT_MESSAGE_KEEP = 6;

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
    model: ORCHESTRATOR_MODELS.CLAUDE_SONNET,
    provider: "anthropic",
    reason: "default: claude-first within context budget",
  };
}

/**
 * Etiqueta legible del modelo para telemetría (sin IDs internos ni prompts).
 */
export function resolveTelemetryModelLabel(
  route: ModelRoute,
  token_count: number,
  task: string
): TelemetryModelLabel {
  if (taskRequiresSonnet(task) && token_count >= OPUS_TOKEN_THRESHOLD) {
    return "Opus 4.8 High";
  }
  if (route.provider === "anthropic") {
    return "Sonnet 4.6 Medium";
  }
  return "Sonnet 4.6 Medium";
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

  getCollection(): string {
    return this.collection;
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
// RAG — retrieveContext (Qdrant, colección editcore_code)
// ---------------------------------------------------------------------------

export interface RetrieveContextOptions {
  /** Consulta semántica; por defecto usa `task`. */
  query?: string;
  topK?: number;
  /** Límite de tokens del contexto RAG (default: 4000). */
  tokenLimit?: number;
  collection?: string;
}

export interface RetrievedContext {
  chunks: RagChunk[];
  chunks_retrieved: number;
  chunks_used: number;
  tokens_estimated: number;
  pruned: boolean;
  additional_context: string;
  trace_log: string;
  collection: string;
  source: "qdrant" | "empty" | "error";
}

/** Formatea fragmentos como bloque de Contexto Adicional para el prompt del modelo. */
export function formatAdditionalContext(chunks: RagChunk[]): string {
  if (chunks.length === 0) {
    return "";
  }
  const body = chunks
    .map(
      (c, i) =>
        `#### Fragmento ${i + 1}: ${c.path} (relevancia ${(c.score ?? 0).toFixed(3)})\n${c.text}`
    )
    .join("\n\n");
  return `## Contexto Adicional (memoria vectorial Qdrant)\n\n${body}`;
}

/** Log de trazabilidad RAG para observabilidad en servicios backend. */
export function formatRagTraceLog(input: {
  collection: string;
  chunks_retrieved: number;
  chunks_used: number;
  tokens_estimated: number;
  pruned: boolean;
  source: RetrievedContext["source"];
}): string {
  return (
    `[EditCore RAG] collection=${input.collection} | source=${input.source} | ` +
    `retrieved=${input.chunks_retrieved} chunks | used=${input.chunks_used} chunks | ` +
    `tokens~${input.tokens_estimated} | pruned=${input.pruned}`
  );
}

/**
 * Búsqueda semántica en Qdrant. Debe ejecutarse antes de `select_model`.
 * Si el contexto supera 4000 tokens, aplica `pruneContext` conservando los hits más relevantes.
 */
export async function retrieveContext(
  task: string,
  deps: Pick<OrchestratorDeps, "embedQuery" | "qdrant">,
  options: RetrieveContextOptions = {}
): Promise<RetrievedContext> {
  const query = options.query ?? task;
  const tokenLimit = options.tokenLimit ?? RAG_CONTEXT_TOKEN_LIMIT;
  const collection = options.collection ?? deps.qdrant.getCollection();
  const topK = options.topK ?? DEFAULT_RAG_TOP_K;

  const empty = (source: RetrievedContext["source"], reason?: string): RetrievedContext => {
    const trace = formatRagTraceLog({
      collection: String(collection),
      chunks_retrieved: 0,
      chunks_used: 0,
      tokens_estimated: 0,
      pruned: false,
      source,
    });
    return {
      chunks: [],
      chunks_retrieved: 0,
      chunks_used: 0,
      tokens_estimated: 0,
      pruned: false,
      additional_context: "",
      trace_log: reason ? `${trace} | note=${reason}` : trace,
      collection: String(collection),
      source,
    };
  };

  if (!query.trim()) {
    return empty("empty", "empty_query");
  }

  let rawChunks: RagChunk[] = [];
  try {
    const vector = await deps.embedQuery(query);
    const hits = await deps.qdrant.search(vector, topK);
    rawChunks = hitsToRagChunks(hits).filter((c) => c.text.trim().length > 0);
  } catch {
    return empty("error", "qdrant_or_embedding_failed");
  }

  if (rawChunks.length === 0) {
    return empty("empty", "no_hits");
  }

  const chunks_retrieved = rawChunks.length;
  const ragTokens = estimateTokens(rawChunks.map((c) => c.text));

  let chunks = rawChunks;
  let pruned = false;

  if (ragTokens > tokenLimit) {
    const prunedRag = pruneContext({
      history: [],
      ragChunks: rawChunks,
      tokenLimit,
      recentKeep: 0,
      maxRagChunks: topK,
    });
    chunks = prunedRag.ragChunks;
    pruned = true;
  }

  const tokens_estimated = estimateTokens(chunks.map((c) => c.text));
  const additional_context = formatAdditionalContext(chunks);
  const trace_log = formatRagTraceLog({
    collection: String(collection),
    chunks_retrieved,
    chunks_used: chunks.length,
    tokens_estimated,
    pruned,
    source: "qdrant",
  });

  return {
    chunks,
    chunks_retrieved,
    chunks_used: chunks.length,
    tokens_estimated,
    pruned,
    additional_context,
    trace_log,
    collection: String(collection),
    source: "qdrant",
  };
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
  /** Bloque listo para inyectar como Contexto Adicional en el prompt. */
  additional_context: string;
  /** Chunks recuperados de Qdrant antes de poda. */
  chunks_retrieved: number;
  /** Chunks usados tras poda (si aplica). */
  chunks_used: number;
  /** Log de trazabilidad RAG (consulta a editcore_code). */
  rag_trace_log: string;
  /** Etiqueta de modelo para telemetría (sin contenido sensible). */
  telemetry_model?: TelemetryModelLabel;
  /** Metadatos de la capa Autocrítica (opcional). */
  self_critique?: SelfCritiqueMeta;
}

export interface SelfCritiqueMeta {
  applied: boolean;
  healed: boolean;
  skipped: boolean;
  validator_model: string;
  reason?: string;
}

/** Callback inyectado por el servicio consumidor para invocar el LLM validador. */
export type ValidationLlmCaller = (
  model: string,
  systemPrompt: string,
  code: string
) => Promise<string>;

export interface SelfCritiqueOptions {
  enabled?: boolean;
  timeoutMs?: number;
  validateGeneration?: ValidationLlmCaller;
}

export interface SelfCritiqueResult {
  code: string;
  meta: SelfCritiqueMeta;
}

export function resolveSelfCritiqueTelemetryStatus(
  meta?: SelfCritiqueMeta
): SelfCritiqueTelemetryStatus {
  if (!meta || meta.skipped) {
    return "skipped";
  }
  if (meta.healed) {
    return "corrected";
  }
  if (meta.applied && meta.reason === "validator_confirmed_valid") {
    return "success";
  }
  if (meta.applied) {
    return "success";
  }
  return "failed";
}

export interface OrchestratorPrepareInput {
  task: string;
  history?: ChatTurn[];
  /** Texto o consulta para recuperar contexto en Qdrant. Por defecto usa `task`. */
  retrievalQuery?: string;
  tokenLimit?: number;
  /** Límite de tokens del bloque RAG (default: 4000). */
  ragTokenLimit?: number;
}

export interface OrchestratorDeps {
  /** Genera el embedding de la consulta (inyectado por el servicio consumidor). */
  embedQuery: (text: string) => Promise<number[]>;
  qdrant: QdrantConnection;
  /** Invoca el modelo validador (Composer 2.5 Fast). Si falta, Autocrítica se omite. */
  validateGeneration?: ValidationLlmCaller;
  /** Activa/desactiva Autocrítica (default: true). */
  selfCritiqueEnabled?: boolean;
  /** Timeout de validación en ms (default: 20s). */
  selfCritiqueTimeoutMs?: number;
  /** Ruta del archivo de métricas (default: .editcore/stats.json). */
  statsPath?: string;
  /** Activa telemetría (default: true). */
  telemetryEnabled?: boolean;
}

// ---------------------------------------------------------------------------
// Telemetría — stats.json (solo metadatos, sin código ni prompts)
// ---------------------------------------------------------------------------

export interface PerformanceMetricEntry {
  timestamp: string;
  model: TelemetryModelLabel;
  tokens_estimated: number;
  self_critique: SelfCritiqueTelemetryStatus;
  latency_ms: number;
  operation: "prepare" | "finalize" | "full_pipeline";
  chunks_retrieved?: number;
  chunks_used?: number;
  rag_pruned?: boolean;
}

export interface PerformanceMetricInput {
  model: TelemetryModelLabel;
  tokens_estimated: number;
  self_critique: SelfCritiqueTelemetryStatus;
  latency_ms: number;
  operation: PerformanceMetricEntry["operation"];
  chunks_retrieved?: number;
  chunks_used?: number;
  rag_pruned?: boolean;
  statsPath?: string;
  enabled?: boolean;
}

interface StatsFileShape {
  version: number;
  entries: PerformanceMetricEntry[];
}

let metricsWriteChain: Promise<void> = Promise.resolve();

function resolveStatsPath(custom?: string): string {
  const fromEnv = process.env.EDITCORE_STATS_PATH;
  return custom ?? fromEnv ?? join(process.cwd(), DEFAULT_STATS_FILE);
}

function enqueueMetricsWrite(task: () => Promise<void>): void {
  metricsWriteChain = metricsWriteChain.then(task).catch(() => undefined);
}

async function persistMetricEntry(
  input: PerformanceMetricInput
): Promise<void> {
  const statsPath = resolveStatsPath(input.statsPath);
  const entry: PerformanceMetricEntry = {
    timestamp: new Date().toISOString(),
    model: input.model,
    tokens_estimated: input.tokens_estimated,
    self_critique: input.self_critique,
    latency_ms: Math.max(0, Math.round(input.latency_ms)),
    operation: input.operation,
  };
  if (input.chunks_retrieved !== undefined) {
    entry.chunks_retrieved = input.chunks_retrieved;
  }
  if (input.chunks_used !== undefined) {
    entry.chunks_used = input.chunks_used;
  }
  if (input.rag_pruned !== undefined) {
    entry.rag_pruned = input.rag_pruned;
  }

  await mkdir(dirname(statsPath), { recursive: true });

  let store: StatsFileShape = { version: 1, entries: [] };
  try {
    const raw = await readFile(statsPath, "utf8");
    const parsed = JSON.parse(raw) as StatsFileShape;
    if (parsed && Array.isArray(parsed.entries)) {
      store = parsed;
    }
  } catch {
    // archivo nuevo o corrupto → se recrea
  }

  store.entries.push(entry);
  await writeFile(statsPath, JSON.stringify(store, null, 2), "utf8");
}

/**
 * Registra métricas de forma asíncrona en stats.json sin bloquear el flujo principal.
 * Solo metadatos: sin código, diffs ni prompts de usuario.
 */
export function logPerformanceMetrics(data: PerformanceMetricInput): void {
  if (data.enabled === false) {
    return;
  }
  enqueueMetricsWrite(() => persistMetricEntry(data));
}

export function createLatencyTracker(): { elapsedMs: () => number } {
  const start = Date.now();
  return {
    elapsedMs: () => Date.now() - start,
  };
}

// ---------------------------------------------------------------------------
// Autocrítica / Self-Healing
// ---------------------------------------------------------------------------

function skippedMeta(reason: string): SelfCritiqueMeta {
  return {
    applied: false,
    healed: false,
    skipped: true,
    validator_model: SELF_CRITIQUE_MODEL_LABEL,
    reason,
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("validation_timeout")), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/** Indica si el validador considera el código aceptable sin cambios. */
export function isValidationPassResponse(text: string): boolean {
  const lower = text.toLowerCase();
  const passPhrases = [
    "código es válido",
    "codigo es valido",
    "no encuentro",
    "no encontré",
    "sin problemas",
    "sin errores",
    "looks valid",
    "no issues",
    "code is valid",
  ];
  const failPhrases = [
    "vulnerabilidad",
    "error de sintaxis",
    "fallo de lógica",
    "corrección",
    "correccion",
    "problema detectado",
    "debes corregir",
    "security issue",
    "syntax error",
  ];
  if (failPhrases.some((p) => lower.includes(p))) {
    return false;
  }
  return passPhrases.some((p) => lower.includes(p));
}

/** Extrae código corregido de la respuesta del validador (bloques fenced o texto completo). */
export function extractCorrectedCode(validatorResponse: string, originalCode: string): string | undefined {
  const fences = [...validatorResponse.matchAll(/```[\w]*\n([\s\S]*?)```/g)];
  if (fences.length > 0) {
    const candidate = fences[fences.length - 1][1].trim();
    if (candidate && candidate !== originalCode.trim()) {
      return candidate;
    }
  }

  const trimmed = validatorResponse.trim();
  if (
    trimmed.length > 0 &&
    trimmed !== originalCode.trim() &&
    !isValidationPassResponse(trimmed) &&
    (trimmed.includes("\n") || trimmed.length > 40)
  ) {
    return trimmed;
  }

  return undefined;
}

/**
 * Capa Autocrítica: valida código generado con Composer 2.5 Fast.
 * Si el validador falla, retorna el código original sin bloquear el flujo.
 */
export async function applySelfCritique(
  generatedCode: string,
  options: SelfCritiqueOptions = {}
): Promise<SelfCritiqueResult> {
  const original = generatedCode;
  const enabled = options.enabled ?? true;
  const caller = options.validateGeneration;

  if (!enabled || !caller || !original.trim()) {
    return { code: original, meta: skippedMeta("self_critique_disabled_or_empty") };
  }

  try {
    const response = await withTimeout(
      caller(SELF_CRITIQUE_MODEL, SELF_CRITIQUE_PROMPT, original),
      options.timeoutMs ?? DEFAULT_VALIDATION_TIMEOUT_MS
    );

    if (isValidationPassResponse(response)) {
      return {
        code: original,
        meta: {
          applied: true,
          healed: false,
          skipped: false,
          validator_model: SELF_CRITIQUE_MODEL_LABEL,
          reason: "validator_confirmed_valid",
        },
      };
    }

    const corrected = extractCorrectedCode(response, original);
    if (corrected) {
      return {
        code: corrected,
        meta: {
          applied: true,
          healed: true,
          skipped: false,
          validator_model: SELF_CRITIQUE_MODEL_LABEL,
          reason: "auto_correction_applied",
        },
      };
    }

    return {
      code: original,
      meta: {
        applied: true,
        healed: false,
        skipped: false,
        validator_model: SELF_CRITIQUE_MODEL_LABEL,
        reason: "validator_inconclusive",
      },
    };
  } catch {
    return { code: original, meta: skippedMeta("validator_failed_fallback_original") };
  }
}

// ---------------------------------------------------------------------------
// Orchestrator — pipeline de ejecución (.cursorrules §4, pasos 1–3)
// ---------------------------------------------------------------------------

export class Orchestrator {
  private readonly selfCritiqueEnabled: boolean;
  private readonly selfCritiqueTimeoutMs: number;
  private readonly validateGeneration?: ValidationLlmCaller;
  private readonly statsPath: string;
  private readonly telemetryEnabled: boolean;
  private suppressTelemetry = false;

  constructor(private readonly deps: OrchestratorDeps) {
    this.selfCritiqueEnabled = deps.selfCritiqueEnabled ?? true;
    this.selfCritiqueTimeoutMs = deps.selfCritiqueTimeoutMs ?? DEFAULT_VALIDATION_TIMEOUT_MS;
    this.validateGeneration = deps.validateGeneration;
    this.statsPath = deps.statsPath ?? resolveStatsPath();
    this.telemetryEnabled = deps.telemetryEnabled ?? true;
  }

  private recordMetrics(input: Omit<PerformanceMetricInput, "statsPath" | "enabled">): void {
    if (this.suppressTelemetry) {
      return;
    }
    logPerformanceMetrics({
      ...input,
      statsPath: this.statsPath,
      enabled: this.telemetryEnabled,
    });
  }

  /**
   * Pipeline invisible:
   * 1. retrieveContext — búsqueda semántica en Qdrant (editcore_code)
   * 2. Estimar tokens (+ poda RAG si > 4000 tokens)
   * 3. select_model (con peso del contexto recuperado)
   */
  async retrieveContextForTask(
    task: string,
    options?: RetrieveContextOptions
  ): Promise<RetrievedContext> {
    return retrieveContext(task, this.deps, options);
  }

  async prepare(input: OrchestratorPrepareInput): Promise<OrchestratorResult> {
    const latency = createLatencyTracker();
    const history = input.history ?? [];
    const query = input.retrievalQuery ?? input.task;

    const retrieved = await retrieveContext(
      input.task,
      this.deps,
      {
        query,
        tokenLimit: input.ragTokenLimit ?? RAG_CONTEXT_TOKEN_LIMIT,
      }
    );

    const pruned = pruneContext({
      history,
      ragChunks: retrieved.chunks,
      tokenLimit: input.tokenLimit ?? DEFAULT_CONTEXT_LIMIT,
    });

    const taskTokens = estimateTokens(input.task);
    const totalTokens =
      pruned.tokens_estimated + taskTokens + retrieved.tokens_estimated;
    const route = select_model(input.task, totalTokens);
    const modelLabel = resolveTelemetryModelLabel(route, totalTokens, input.task);

    const context_summary = retrieved.pruned
      ? `${retrieved.trace_log} | history_pruned=${pruned.pruned}`
      : `${retrieved.trace_log} | history=${pruned.summary}`;

    const result: OrchestratorResult = {
      model_used: route.model,
      tokens_estimated: totalTokens,
      diff: "",
      provider: route.provider,
      route_reason: route.reason,
      pruned: retrieved.pruned || pruned.pruned,
      rag_chunks: retrieved.chunks,
      context_summary,
      additional_context: retrieved.additional_context,
      chunks_retrieved: retrieved.chunks_retrieved,
      chunks_used: retrieved.chunks_used,
      rag_trace_log: retrieved.trace_log,
      telemetry_model: modelLabel,
    };

    this.recordMetrics({
      model: modelLabel,
      tokens_estimated: totalTokens,
      self_critique: "skipped",
      latency_ms: latency.elapsedMs(),
      operation: "prepare",
      chunks_retrieved: retrieved.chunks_retrieved,
      chunks_used: retrieved.chunks_used,
      rag_pruned: retrieved.pruned,
    });

    return result;
  }

  /** Serializa el resultado al JSON exigido por .cursorrules §3. */
  static toStructuredJson(result: OrchestratorResult): string {
    return JSON.stringify({
      model_used: result.model_used,
      tokens_estimated: result.tokens_estimated,
      diff: result.diff,
      chunks_retrieved: result.chunks_retrieved,
      chunks_used: result.chunks_used,
      rag_trace_log: result.rag_trace_log,
    });
  }

  /** Actualiza `diff` tras que un servicio genere el parche de código. */
  static withDiff(result: OrchestratorResult, diff: string): OrchestratorResult {
    return { ...result, diff };
  }

  /**
   * Finaliza una generación aplicando Autocrítica sobre el código/diff.
   * Asíncrono y transparente: si el validador falla, devuelve el código original.
   */
  async finalizeResult(
    result: OrchestratorResult,
    generatedCode: string
  ): Promise<OrchestratorResult> {
    const latency = createLatencyTracker();
    const critique = await applySelfCritique(generatedCode, {
      enabled: this.selfCritiqueEnabled,
      validateGeneration: this.validateGeneration,
      timeoutMs: this.selfCritiqueTimeoutMs,
    });

    const critiqueStatus = resolveSelfCritiqueTelemetryStatus(critique.meta);
    const modelLabel: TelemetryModelLabel =
      critique.meta.applied && !critique.meta.skipped
        ? SELF_CRITIQUE_MODEL_LABEL
        : (result.telemetry_model ?? "Sonnet 4.6 Medium");

    this.recordMetrics({
      model: modelLabel,
      tokens_estimated: result.tokens_estimated,
      self_critique: critiqueStatus,
      latency_ms: latency.elapsedMs(),
      operation: "finalize",
      chunks_retrieved: result.chunks_retrieved,
      chunks_used: result.chunks_used,
      rag_pruned: result.pruned,
    });

    return {
      ...result,
      diff: critique.code,
      self_critique: critique.meta,
    };
  }

  /**
   * Pipeline completo: prepare → (el servicio genera código) → finalizeResult.
   * Registra una métrica consolidada con latencia total.
   */
  async prepareAndFinalize(
    input: OrchestratorPrepareInput,
    generatedCode: string
  ): Promise<OrchestratorResult> {
    const latency = createLatencyTracker();
    this.suppressTelemetry = true;
    try {
      const prepared = await this.prepare(input);
      const finalized = await this.finalizeResult(prepared, generatedCode);

      this.suppressTelemetry = false;
      this.recordMetrics({
        model: finalized.telemetry_model ?? "Sonnet 4.6 Medium",
        tokens_estimated: finalized.tokens_estimated,
        self_critique: resolveSelfCritiqueTelemetryStatus(finalized.self_critique),
        latency_ms: latency.elapsedMs(),
        operation: "full_pipeline",
        chunks_retrieved: finalized.chunks_retrieved,
        chunks_used: finalized.chunks_used,
        rag_pruned: finalized.pruned,
      });

      return finalized;
    } finally {
      this.suppressTelemetry = false;
    }
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
    validateGeneration: deps.validateGeneration,
    selfCritiqueEnabled: deps.selfCritiqueEnabled,
    selfCritiqueTimeoutMs: deps.selfCritiqueTimeoutMs,
    statsPath: deps.statsPath,
    telemetryEnabled: deps.telemetryEnabled,
  });
}
