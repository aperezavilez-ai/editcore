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
  return { Authorization: `Bearer ${token.trim()}` };
}

export interface VercelTokenCheck {
  ok: boolean;
  error?: string;
}

/** Valida token probando user, proyectos personales y equipos (tokens con scope de team). */
export async function verifyVercelToken(token: string): Promise<VercelTokenCheck> {
  const t = token.trim();
  if (!t) {
    return { ok: false, error: "Token vacío" };
  }
  if (t.length < 24) {
    return {
      ok: false,
      error: "Token muy corto. Copiá el secreto completo (solo visible al crear el token en Vercel).",
    };
  }

  const headers = authHeaders(t);

  const userRes = await httpJson(`${VERCEL_API}/v2/user`, { headers });
  if (userRes.ok) {
    return { ok: true };
  }

  const projectsRes = await httpJson<{ projects: VercelProject[] }>(
    `${VERCEL_API}/v9/projects?limit=1`,
    { headers }
  );
  if (projectsRes.ok) {
    return { ok: true };
  }

  const teamsRes = await httpJson<{ teams: { id: string }[] }>(`${VERCEL_API}/v2/teams`, { headers });
  if (teamsRes.ok && teamsRes.data?.teams?.length) {
    for (const team of teamsRes.data.teams) {
      const teamProjects = await httpJson(`${VERCEL_API}/v9/projects?teamId=${team.id}&limit=1`, {
        headers,
      });
      if (teamProjects.ok) {
        return { ok: true };
      }
    }
  }

  const detail =
    userRes.error ??
    projectsRes.error ??
    teamsRes.error ??
    "No se pudo verificar con la API de Vercel";
  return { ok: false, error: detail };
}

export async function listVercelProjects(token: string): Promise<VercelProject[]> {
  const headers = authHeaders(token);
  const seen = new Set<string>();
  const all: VercelProject[] = [];

  const add = (items: VercelProject[] | undefined) => {
    for (const p of items ?? []) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        all.push(p);
      }
    }
  };

  const personal = await httpJson<{ projects: VercelProject[] }>(`${VERCEL_API}/v9/projects`, {
    headers,
  });
  if (personal.ok) {
    add(personal.data?.projects);
  }

  const teams = await httpJson<{ teams: { id: string }[] }>(`${VERCEL_API}/v2/teams`, { headers });
  if (teams.ok) {
    for (const team of teams.data?.teams ?? []) {
      const tp = await httpJson<{ projects: VercelProject[] }>(
        `${VERCEL_API}/v9/projects?teamId=${team.id}`,
        { headers }
      );
      if (tp.ok) {
        add(tp.data?.projects);
      }
    }
  }

  return all;
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
