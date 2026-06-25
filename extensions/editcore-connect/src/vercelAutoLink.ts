import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { listVercelProjects, listVercelEnvVars, verifyVercelToken, VercelProject } from "./api/vercelApi";
import { getWorkspaceHints, scoreNameMatch, normalizeGithubSlug } from "./workspaceHints";
import { getVercelProjectState } from "./vercelService";

const WORKSPACE_PROJECT_KEY = "editcoreConnect.vercelProjectId";

export async function validateVercelAccount(
  token: string
): Promise<{ ok: boolean; projects: VercelProject[]; error?: string }> {
  const check = await verifyVercelToken(token);
  if (!check.ok) {
    return { ok: false, projects: [], error: check.error };
  }
  const projects = await listVercelProjects(token);
  return { ok: true, projects };
}

export async function writeVercelProjectLink(cwd: string, project: VercelProject): Promise<void> {
  const dir = path.join(cwd, ".vercel");
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(
    path.join(dir, "project.json"),
    JSON.stringify(
      {
        projectId: project.id,
        orgId: project.accountId,
        projectName: project.name,
      },
      null,
      2
    ),
    "utf8"
  );
}

async function pullDevEnvVars(
  cwd: string,
  token: string,
  project: VercelProject
): Promise<void> {
  const envs = await listVercelEnvVars(token, project.id, project.accountId);
  const devVars = envs.filter(
    (e) => !e.target || e.target.includes("development") || e.target.includes("preview")
  );
  if (!devVars.length) return;

  const envPath = path.join(cwd, ".env.local");
  let existing = "";
  if (fs.existsSync(envPath)) {
    existing = fs.readFileSync(envPath, "utf8");
  }

  const lines: string[] = existing ? [existing.trimEnd()] : [];
  const existingKeys = new Set(
    existing
      .split("\n")
      .map((l) => l.split("=")[0]?.trim())
      .filter(Boolean)
  );

  for (const v of devVars) {
    if (!v.key || existingKeys.has(v.key) || v.value === undefined) continue;
    lines.push(`${v.key}=${v.value}`);
  }

  if (lines.length > (existing ? 1 : 0)) {
    await fs.promises.writeFile(envPath, lines.join("\n") + "\n", "utf8");
  }
}

function pickBestProject(
  projects: VercelProject[],
  hints: string[],
  gitRemoteSlug?: string,
  savedId?: string
): VercelProject | undefined {
  if (savedId) {
    const saved = projects.find((p) => p.id === savedId);
    if (saved) return saved;
  }

  if (gitRemoteSlug) {
    const slug = normalizeGithubSlug(gitRemoteSlug);
    if (slug) {
      const byRepo = projects.find((p) => {
        const link = p.link?.repo;
        if (!link) return false;
        const linkSlug = normalizeGithubSlug(link);
        return linkSlug === slug;
      });
      if (byRepo) return byRepo;
    }
  }

  if (projects.length === 1) {
    return projects[0];
  }

  const scored = projects
    .map((p) => ({ p, score: scoreNameMatch(p.name, hints) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 1 && scored[0].score >= 40) return scored[0].p;
  if (scored.length > 0 && scored[0].score >= 60) return scored[0].p;
  return undefined;
}

export async function autoLinkVercelProject(
  context: vscode.ExtensionContext,
  cwd: string,
  token: string,
  options: { silent?: boolean; forcePick?: boolean } = {}
): Promise<{ linked: boolean; projectName?: string; message?: string }> {
  const state = await getVercelProjectState(cwd, context);
  if (state.linked && !options.forcePick) {
    return { linked: true, projectName: state.projectName };
  }

  const { ok, projects } = await validateVercelAccount(token);
  if (!ok) {
    return { linked: false, message: "Token de Vercel inválido o sin acceso." };
  }

  const hints = await getWorkspaceHints(cwd);
  const savedId = context.workspaceState.get<string>(WORKSPACE_PROJECT_KEY);

  let project = options.forcePick
    ? undefined
    : pickBestProject(projects, hints.all, hints.gitRemoteSlug, savedId);

  if (!project) {
    if (options.silent && !options.forcePick) {
      return {
        linked: false,
        message:
          projects.length === 0
            ? "No hay proyectos en tu cuenta Vercel."
            : "Abrí la carpeta del repo o usá «Cambiar proyecto» si el nombre no coincide.",
      };
    }

    const pick = await vscode.window.showQuickPick(
      projects.map((p) => ({
        label: p.name,
        description: p.id,
        project: p,
      })),
      {
        placeHolder: `Vincular «${hints.folderName}» a un proyecto Vercel (una vez por carpeta)`,
        title: "EditCore — proyecto Vercel",
      }
    );
    if (!pick) return { linked: false, message: "Cancelado" };
    project = pick.project;
  }

  await writeVercelProjectLink(cwd, project);
  await context.workspaceState.update(WORKSPACE_PROJECT_KEY, project.id);

  const pullEnv = vscode.workspace
    .getConfiguration("editcoreConnect")
    .get<boolean>("vercel.pullEnvOnLink", true);
  if (pullEnv) {
    await pullDevEnvVars(cwd, token, project).catch(() => undefined);
  }

  return { linked: true, projectName: project.name };
}
