import * as vscode from 'vscode';

const VOYAGE_SECRET = 'voyageApiKey';
const VOYAGE_EMBED_URL = 'https://api.voyageai.com/v1/embeddings';
const BATCH_SIZE = 16;

let extensionContext: vscode.ExtensionContext | undefined;

export function initVoyageService(context: vscode.ExtensionContext): void {
  extensionContext = context;
}

export async function getVoyageApiKey(): Promise<string | undefined> {
  if (!extensionContext) return undefined;
  const key = await extensionContext.secrets.get(VOYAGE_SECRET);
  return key?.trim() || undefined;
}

export async function saveVoyageApiKey(raw: string): Promise<void> {
  if (!extensionContext) throw new Error('Voyage service no inicializado');
  const key = raw.trim();
  if (!key) throw new Error('La API Key no puede estar vacía.');
  await validateVoyageKey(key);
  await extensionContext.secrets.store(VOYAGE_SECRET, key);
}

export async function clearVoyageApiKey(): Promise<void> {
  if (!extensionContext) return;
  await extensionContext.secrets.delete(VOYAGE_SECRET);
}

export async function getVoyageKeyHint(): Promise<string> {
  const key = await getVoyageApiKey();
  if (!key) return 'Sin configurar';
  return key.length <= 12 ? '••••••••' : `${key.slice(0, 6)}…${key.slice(-4)}`;
}

export function isEmbeddingsEnabled(): boolean {
  return vscode.workspace.getConfiguration('editcore').get<boolean>('rag.useEmbeddings', true);
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const key = await getVoyageApiKey();
  if (!key) {
    throw new Error('Sin Voyage API Key. Configurala en EditCore → Cuenta & API.');
  }
  const model = vscode.workspace.getConfiguration('editcore').get<string>('rag.embeddingModel', 'voyage-3-lite');
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE).map((t) => t.slice(0, 8000));
    const res = await fetch(VOYAGE_EMBED_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input: batch, model, input_type: 'document' }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Voyage embeddings HTTP ${res.status}: ${body.slice(0, 200)}`);
    }
    const json = (await res.json()) as { data: Array<{ embedding: number[] }> };
    for (const row of json.data) {
      results.push(row.embedding);
    }
  }
  return results;
}

export async function embedQuery(text: string): Promise<number[]> {
  const key = await getVoyageApiKey();
  if (!key) throw new Error('Sin Voyage API Key');
  const model = vscode.workspace.getConfiguration('editcore').get<string>('rag.embeddingModel', 'voyage-3-lite');
  const res = await fetch(VOYAGE_EMBED_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input: [text.slice(0, 8000)], model, input_type: 'query' }),
  });
  if (!res.ok) {
    throw new Error(`Voyage query embed HTTP ${res.status}`);
  }
  const json = (await res.json()) as { data: Array<{ embedding: number[] }> };
  return json.data[0].embedding;
}

export function cosineFloat(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function validateVoyageKey(key: string): Promise<void> {
  const res = await fetch(VOYAGE_EMBED_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input: ['validation'], model: 'voyage-3-lite', input_type: 'query' }),
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error('Voyage API Key inválida o sin permisos.');
  }
  if (!res.ok && res.status !== 429) {
    const t = await res.text();
    throw new Error(`No se pudo validar Voyage: ${t.slice(0, 120)}`);
  }
}
