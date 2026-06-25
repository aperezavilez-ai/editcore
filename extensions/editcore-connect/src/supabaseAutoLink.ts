import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { listSupabaseProjects, SupabaseProject } from "./api/supabaseApi";
import { getWorkspaceHints, scoreNameMatch } from "./workspaceHints";

const WORKSPACE_SUPABASE_KEY = "editcoreConnect.supabaseProjectRef";

export async function validateSupabaseAccount(
  token: string
): Promise<{ ok: boolean; projects: SupabaseProject[] }> {
  const projects = await listSupabaseProjects(token);
  return { ok: projects.length > 0, projects };
}

export async function writeSupabaseProjectLink(cwd: string, project: SupabaseProject): Promise<void> {
  const supabaseDir = path.join(cwd, "supabase");
  await fs.promises.mkdir(path.join(supabaseDir, ".temp"), { recursive: true });
  await fs.promises.writeFile(
    path.join(supabaseDir, ".temp", "project-ref"),
    project.id,
    "utf8"
  );

  const configPath = path.join(supabaseDir, "config.toml");
  if (fs.existsSync(configPath)) {
    let content = fs.readFileSync(configPath, "utf8");
    if (/project_id\s*=/.test(content)) {
      content = content.replace(/project_id\s*=\s*"[^"]*"/, `project_id = "${project.id}"`);
    } else {
      content = `project_id = "${project.id}"\n` + content;
    }
    await fs.promises.writeFile(configPath, content, "utf8");
  } else {
    await fs.promises.mkdir(supabaseDir, { recursive: true });
    await fs.promises.writeFile(
      configPath,
      `# EditCore — vinculado a ${project.name}\nproject_id = "${project.id}"\n`,
      "utf8"
    );
  }
}

function pickBestSupabaseProject(
  projects: SupabaseProject[],
  hints: string[],
  savedRef?: string
): SupabaseProject | undefined {
  if (savedRef) {
    const saved = projects.find((p) => p.id === savedRef);
    if (saved) return saved;
  }

  const scored = projects
    .map((p) => ({ p, score: scoreNameMatch(p.name, hints) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 1 && scored[0].score >= 40) return scored[0].p;
  if (scored.length > 0 && scored[0].score >= 100) return scored[0].p;
  return undefined;
}

export function getSupabaseLinkRef(cwd: string): string | undefined {
  const refPath = path.join(cwd, "supabase", ".temp", "project-ref");
  if (fs.existsSync(refPath)) {
    return fs.readFileSync(refPath, "utf8").trim() || undefined;
  }
  const configPath = path.join(cwd, "supabase", "config.toml");
  if (fs.existsSync(configPath)) {
    const m = fs.readFileSync(configPath, "utf8").match(/project_id\s*=\s*"([^"]+)"/);
    return m?.[1];
  }
  return undefined;
}

export async function autoLinkSupabaseProject(
  context: vscode.ExtensionContext,
  cwd: string,
  token: string,
  options: { silent?: boolean; forcePick?: boolean } = {}
): Promise<{ linked: boolean; projectName?: string; message?: string }> {
  const existingRef = getSupabaseLinkRef(cwd);
  if (existingRef && !options.forcePick) {
    const { projects } = await validateSupabaseAccount(token);
    const p = projects.find((x) => x.id === existingRef);
    return { linked: true, projectName: p?.name ?? existingRef };
  }

  const { ok, projects } = await validateSupabaseAccount(token);
  if (!ok) {
    return { linked: false, message: "Token de Supabase inválido o sin proyectos." };
  }

  const hints = await getWorkspaceHints(cwd);
  const savedRef = context.workspaceState.get<string>(WORKSPACE_SUPABASE_KEY);

  let project = options.forcePick ? undefined : pickBestSupabaseProject(projects, hints.all, savedRef);

  if (!project) {
    if (options.silent && !options.forcePick) {
      return { linked: false, message: "Sin coincidencia automática de proyecto Supabase." };
    }

    const pick = await vscode.window.showQuickPick(
      projects.map((p) => ({
        label: p.name,
        description: `${p.region} — ${p.id}`,
        project: p,
      })),
      {
        placeHolder: `Vincular «${hints.folderName}» a un proyecto Supabase`,
        title: "EditCore — proyecto Supabase",
      }
    );
    if (!pick) return { linked: false, message: "Cancelado" };
    project = pick.project;
  }

  await writeSupabaseProjectLink(cwd, project);
  await context.workspaceState.update(WORKSPACE_SUPABASE_KEY, project.id);

  return { linked: true, projectName: project.name };
}
