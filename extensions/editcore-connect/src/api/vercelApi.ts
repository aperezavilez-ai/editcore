import { httpJson } from "./httpClient";

export interface VercelProject {
  id: string;
  name: string;
  accountId: string;
  link?: { type: string; repo?: string };
}

export interface VercelDeployment {
  uid: string;
  url: string;
  state: string;
  created: number;
  target?: string;
}

export interface VercelEnvVar {
  key: string;
  value?: string;
  type: string;
  target?: string[];
}

const VERCEL_API = "https://api.vercel.com";

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

export async function listVercelProjects(token: string): Promise<VercelProject[]> {
  const res = await httpJson<{ projects: VercelProject[] }>(`${VERCEL_API}/v9/projects`, {
    headers: authHeaders(token),
  });
  return res.ok ? res.data?.projects ?? [] : [];
}

export async function verifyVercelToken(token: string): Promise<boolean> {
  const res = await httpJson(`${VERCEL_API}/v2/user`, { headers: authHeaders(token) });
  return res.ok;
}

export async function getVercelProject(
  token: string,
  projectId: string,
  teamId?: string
): Promise<VercelProject | undefined> {
  const qs = teamId ? `?teamId=${teamId}` : "";
  const res = await httpJson<VercelProject>(`${VERCEL_API}/v9/projects/${projectId}${qs}`, {
    headers: authHeaders(token),
  });
  return res.ok ? res.data : undefined;
}

export async function listVercelDeployments(
  token: string,
  projectId: string,
  teamId?: string,
  limit = 5
): Promise<VercelDeployment[]> {
  const qs = new URLSearchParams({ projectId, limit: String(limit) });
  if (teamId) qs.set("teamId", teamId);
  const res = await httpJson<{ deployments: VercelDeployment[] }>(
    `${VERCEL_API}/v6/deployments?${qs}`,
    { headers: authHeaders(token) }
  );
  return res.ok ? res.data?.deployments ?? [] : [];
}

export async function listVercelEnvVars(
  token: string,
  projectId: string,
  teamId?: string
): Promise<VercelEnvVar[]> {
  const qs = teamId ? `?teamId=${teamId}` : "";
  const res = await httpJson<{ envs: VercelEnvVar[] }>(
    `${VERCEL_API}/v9/projects/${projectId}/env${qs}`,
    { headers: authHeaders(token) }
  );
  return res.ok ? res.data?.envs ?? [] : [];
}

export async function createVercelEnvVar(
  token: string,
  projectId: string,
  key: string,
  value: string,
  targets: string[] = ["production", "preview", "development"],
  teamId?: string
): Promise<{ ok: boolean; message: string }> {
  const qs = teamId ? `?teamId=${teamId}` : "";
  const res = await httpJson(`${VERCEL_API}/v10/projects/${projectId}/env${qs}`, {
    method: "POST",
    headers: authHeaders(token),
    body: { key, value, type: "encrypted", target: targets },
  });
  return res.ok
    ? { ok: true, message: `Variable ${key} creada` }
    : { ok: false, message: res.error ?? "Error al crear variable" };
}

export async function rollbackVercelDeployment(
  token: string,
  deploymentId: string,
  teamId?: string
): Promise<{ ok: boolean; message: string }> {
  const qs = teamId ? `?teamId=${teamId}` : "";
  const res = await httpJson(`${VERCEL_API}/v13/deployments/${deploymentId}/rollback${qs}`, {
    method: "POST",
    headers: authHeaders(token),
  });
  return res.ok
    ? { ok: true, message: "Rollback iniciado" }
    : { ok: false, message: res.error ?? "Error en rollback" };
}
