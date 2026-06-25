import { httpJson } from "./httpClient";

export interface GhRepo {
  full_name: string;
  html_url: string;
  default_branch: string;
  private: boolean;
}

export interface GhWorkflowRun {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  html_url: string;
  created_at: string;
}

export interface GhPullRequest {
  number: number;
  title: string;
  state: string;
  html_url: string;
  user: { login: string };
}

export async function getRepoFromRemote(
  token: string,
  owner: string,
  repo: string
): Promise<GhRepo | undefined> {
  const res = await httpJson<GhRepo>(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: { Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28" },
  });
  return res.ok ? res.data : undefined;
}

export async function listWorkflowRuns(
  token: string,
  owner: string,
  repo: string,
  limit = 5
): Promise<GhWorkflowRun[]> {
  const res = await httpJson<{ workflow_runs: GhWorkflowRun[] }>(
    `https://api.github.com/repos/${owner}/${repo}/actions/runs?per_page=${limit}`,
    { headers: { Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28" } }
  );
  return res.ok ? res.data?.workflow_runs ?? [] : [];
}

export async function listPullRequestsApi(
  token: string,
  owner: string,
  repo: string,
  limit = 10
): Promise<GhPullRequest[]> {
  const res = await httpJson<GhPullRequest[]>(
    `https://api.github.com/repos/${owner}/${repo}/pulls?state=open&per_page=${limit}`,
    { headers: { Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28" } }
  );
  return res.ok ? res.data ?? [] : [];
}

export async function triggerWorkflowDispatch(
  token: string,
  owner: string,
  repo: string,
  workflowId: string,
  ref: string
): Promise<{ ok: boolean; message: string }> {
  const res = await httpJson(
    `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28" },
      body: { ref },
    }
  );
  return res.ok
    ? { ok: true, message: "Workflow disparado" }
    : { ok: false, message: res.error ?? "Error al disparar workflow" };
}

export function parseGithubRemote(remoteUrl: string): { owner: string; repo: string } | undefined {
  const m =
    remoteUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)/) ??
    remoteUrl.match(/github\.com\/([^/]+)\/([^/.]+)/);
  if (!m) return undefined;
  return { owner: m[1], repo: m[2].replace(/\.git$/, "") };
}

export async function getRemoteFromGit(cwd: string): Promise<string | undefined> {
  const { exec } = await import("child_process");
  const { promisify } = await import("util");
  const execAsync = promisify(exec);
  try {
    const { stdout } = await execAsync("git remote get-url origin", {
      cwd,
      timeout: 10_000,
      shell: process.platform === "win32" ? "cmd.exe" : "/bin/sh",
    });
    return stdout.trim();
  } catch {
    return undefined;
  }
}
