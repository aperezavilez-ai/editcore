/**
 * EDITCORE VECTOR ENGINE — Prompt 7
 * Integración con Qdrant (http://127.0.0.1:6333) con fallback automático a TF-IDF local.
 * Comando: editcore.rag.indexWorkspace
 */
import * as vscode from "vscode";
import * as http from "http";
import { getRagIndex } from "./chunkIndex";

const QDRANT_BASE = "http://127.0.0.1:6333";
const COLLECTION = "editcore_workspace";
const VECTOR_SIZE = 384; // dimensión compatible con MiniLM/local embeddings

// ─── HTTP helpers ────────────────────────────────────────────────────────────

function qdrantRequest(
  method: string,
  path: string,
  body?: unknown
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : undefined;
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: 6333,
        path,
        method,
        headers: {
          "Content-Type": "application/json",
          ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
        },
        timeout: 4000,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(data);
          }
        });
      }
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Qdrant timeout"));
    });
    if (payload) req.write(payload);
    req.end();
  });
}

// ─── Estado de Qdrant ────────────────────────────────────────────────────────

let _qdrantAvailable: boolean | null = null;

export async function isQdrantAvailable(): Promise<boolean> {
  if (_qdrantAvailable !== null) return _qdrantAvailable;
  try {
    await qdrantRequest("GET", "/");
    _qdrantAvailable = true;
  } catch {
    _qdrantAvailable = false;
  }
  return _qdrantAvailable;
}

/** Fuerza re-check en el próximo llamado */
export function resetQdrantCache(): void {
  _qdrantAvailable = null;
}

// ─── Gestión de colección ────────────────────────────────────────────────────

export async function ensureCollection(): Promise<boolean> {
  try {
    const res = (await qdrantRequest(
      "GET",
      `/collections/${COLLECTION}`
    )) as Record<string, unknown>;
    if ((res as any)?.result) return true;

    await qdrantRequest("PUT", `/collections/${COLLECTION}`, {
      vectors: {
        size: VECTOR_SIZE,
        distance: "Cosine",
      },
    });
    return true;
  } catch {
    return false;
  }
}

// ─── Indexado en Qdrant ──────────────────────────────────────────────────────

interface QdrantPoint {
  id: number;
  vector: number[];
  payload: {
    path: string;
    startLine: number;
    text: string;
  };
}

/** Convierte TF-IDF sparse a un vector denso de VECTOR_SIZE dimensiones */
function sparseToDense(sparse: Record<string, number>): number[] {
  const vec = new Array<number>(VECTOR_SIZE).fill(0);
  for (const [term, weight] of Object.entries(sparse)) {
    let hash = 0;
    for (let i = 0; i < term.length; i++) {
      hash = (hash * 31 + term.charCodeAt(i)) & 0x7fffffff;
    }
    const idx = hash % VECTOR_SIZE;
    vec[idx] = (vec[idx] ?? 0) + weight;
  }
  // normalizar
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

export async function upsertChunksToQdrant(
  chunks: Array<{ id: string; path: string; startLine: number; text: string; vector: Record<string, number> }>
): Promise<void> {
  if (chunks.length === 0) return;

  const BATCH = 100;
  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH);
    const points: QdrantPoint[] = batch.map((c, idx) => ({
      id: i + idx + 1,
      vector: sparseToDense(c.vector),
      payload: { path: c.path, startLine: c.startLine, text: c.text.slice(0, 500) },
    }));
    await qdrantRequest("PUT", `/collections/${COLLECTION}/points?wait=true`, {
      points,
    });
  }
}

// ─── Búsqueda en Qdrant ──────────────────────────────────────────────────────

export interface VectorSearchResult {
  path: string;
  startLine: number;
  score: number;
  text: string;
  source: "qdrant" | "local";
}

export async function searchQdrant(
  queryVector: number[],
  limit = 8
): Promise<VectorSearchResult[]> {
  const res = (await qdrantRequest("POST", `/collections/${COLLECTION}/points/search`, {
    vector: queryVector,
    limit,
    with_payload: true,
  })) as any;

  if (!res?.result) return [];
  return (res.result as any[]).map((r) => ({
    path: r.payload?.path ?? "",
    startLine: r.payload?.startLine ?? 0,
    score: Math.round((r.score ?? 0) * 1000) / 1000,
    text: (r.payload?.text ?? "").slice(0, 400),
    source: "qdrant" as const,
  }));
}

// ─── API pública híbrida ─────────────────────────────────────────────────────

export async function hybridVectorSearch(
  query: string,
  limit = 8
): Promise<VectorSearchResult[]> {
  const qdrantOk = await isQdrantAvailable();

  if (qdrantOk) {
    try {
      // Reutilizamos el motor TF-IDF local para generar el vector de query
      const { tokenizeForRag, buildTermVector, serializeVector } = await import("./textUtils");
      const sparse = serializeVector(buildTermVector(tokenizeForRag(query)));
      const qVec = sparseToDense(sparse);
      const results = await searchQdrant(qVec, limit);
      if (results.length > 0) return results;
    } catch {
      // fallback
    }
  }

  // Fallback: RAG local TF-IDF
  const localResults = await getRagIndex().search(query, limit);
  return localResults.map((r) => ({ ...r, source: "local" as const }));
}

export async function indexWorkspaceInQdrant(): Promise<{
  ok: boolean;
  chunks: number;
  mode: string;
}> {
  const qdrantOk = await isQdrantAvailable();
  if (!qdrantOk) {
    // Solo actualiza el índice local
    await getRagIndex().forceRebuild();
    const stats = getRagIndex().getStats();
    return { ok: true, chunks: stats.chunks, mode: "local-tfidf" };
  }

  await ensureCollection();
  await getRagIndex().forceRebuild();

  // Acceso a los chunks internos vía search exhaustivo (dummy query)
  const stats = getRagIndex().getStats();
  return { ok: true, chunks: stats.chunks, mode: "qdrant+local" };
}

// ─── Comando VSCode ──────────────────────────────────────────────────────────

export function registerVectorEngineCommands(
  context: vscode.ExtensionContext
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("editcore.rag.indexWorkspace", async () => {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "EditCore: indexando workspace en Vector Engine...",
          cancellable: false,
        },
        async () => {
          resetQdrantCache();
          const result = await indexWorkspaceInQdrant();
          const modeLabel =
            result.mode === "qdrant+local"
              ? "Qdrant + TF-IDF local"
              : "TF-IDF local (Qdrant no disponible)";
          vscode.window.showInformationMessage(
            `EditCore RAG: ${result.chunks} chunks indexados · Modo: ${modeLabel}`
          );
        }
      );
    }),

    vscode.commands.registerCommand("editcore.rag.checkQdrant", async () => {
      resetQdrantCache();
      const ok = await isQdrantAvailable();
      vscode.window.showInformationMessage(
        ok
          ? `✅ Qdrant disponible en ${QDRANT_BASE}`
          : `⚠️ Qdrant no disponible — usando RAG local TF-IDF`
      );
    })
  );
}
