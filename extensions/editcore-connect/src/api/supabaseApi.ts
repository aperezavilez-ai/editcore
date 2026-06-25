import { httpJson } from "./httpClient";

export interface SupabaseProject {
  id: string;
  name: string;
  organization_id: string;
  region: string;
  status: string;
  database?: { host: string; version: string };
}

export interface SupabaseMigration {
  version: string;
  name?: string;
}

const SUPABASE_API = "https://api.supabase.com/v1";

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

export async function listSupabaseProjects(token: string): Promise<SupabaseProject[]> {
  const res = await httpJson<SupabaseProject[]>(`${SUPABASE_API}/projects`, {
    headers: authHeaders(token),
  });
  return res.ok && Array.isArray(res.data) ? res.data : [];
}

export async function getSupabaseProject(
  token: string,
  projectRef: string
): Promise<SupabaseProject | undefined> {
  const res = await httpJson<SupabaseProject>(`${SUPABASE_API}/projects/${projectRef}`, {
    headers: authHeaders(token),
  });
  return res.ok ? res.data : undefined;
}

export async function listSupabaseSecrets(
  token: string,
  projectRef: string
): Promise<string[]> {
  const res = await httpJson<{ name: string }[]>(
    `${SUPABASE_API}/projects/${projectRef}/secrets`,
    { headers: authHeaders(token) }
  );
  return res.ok ? (res.data ?? []).map((s) => s.name) : [];
}

export async function createSupabaseSecret(
  token: string,
  projectRef: string,
  name: string,
  value: string
): Promise<{ ok: boolean; message: string }> {
  const res = await httpJson(`${SUPABASE_API}/projects/${projectRef}/secrets`, {
    method: "POST",
    headers: authHeaders(token),
    body: [{ name, value }],
  });
  return res.ok
    ? { ok: true, message: `Secret ${name} creado` }
    : { ok: false, message: res.error ?? "Error al crear secret" };
}

export async function getSupabaseApiKeys(
  token: string,
  projectRef: string
): Promise<{ anon?: string; service?: string }> {
  const res = await httpJson<{ name: string; api_key: string }[]>(
    `${SUPABASE_API}/projects/${projectRef}/api-keys`,
    { headers: authHeaders(token) }
  );
  if (!res.ok || !res.data) return {};
  const anon = res.data.find((k) => k.name === "anon")?.api_key;
  const service = res.data.find((k) => k.name === "service_role")?.api_key;
  return { anon, service };
}
