import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface GitChangeSummary {
  available: boolean;
  branch?: string;
  staged: string[];
  unstaged: string[];
  untracked: string[];
  diffStat: string;
  recentCommits: string[];
}

export async function collectGitChanges(root: string): Promise<GitChangeSummary> {
  const empty: GitChangeSummary = {
    available: false,
    staged: [],
    unstaged: [],
    untracked: [],
    diffStat: "",
    recentCommits: [],
  };

  try {
    await execAsync("git rev-parse --is-inside-work-tree", { cwd: root });
  } catch {
    return empty;
  }

  const summary: GitChangeSummary = { ...empty, available: true };

  try {
    const { stdout: branch } = await execAsync("git branch --show-current", { cwd: root });
    summary.branch = branch.trim();
  } catch {
    // opcional
  }

  try {
    const { stdout: status } = await execAsync("git status --porcelain", { cwd: root });
    for (const line of status.split("\n").filter(Boolean)) {
      const code = line.slice(0, 2);
      const file = line.slice(3).trim();
      if (code.startsWith("?")) {
        summary.untracked.push(file);
      } else if (code[0] !== " " && code[0] !== "?") {
        summary.staged.push(file);
      } else if (code[1] !== " ") {
        summary.unstaged.push(file);
      }
    }
  } catch {
    // opcional
  }

  try {
    const { stdout: diffStat } = await execAsync("git diff --stat HEAD", { cwd: root });
    summary.diffStat = diffStat.trim().slice(0, 4000);
  } catch {
    // opcional
  }

  try {
    const { stdout: log } = await execAsync('git log -5 --oneline', { cwd: root });
    summary.recentCommits = log.trim().split("\n").filter(Boolean);
  } catch {
    // opcional
  }

  return summary;
}

export function formatChangeReportMarkdown(
  git: GitChangeSummary,
  sessionMeta?: {
    agents?: string[];
    toolCalls?: number;
    tasksCompleted?: string[];
    validationPassed?: boolean;
  }
): string {
  const lines = [
    "# REPORTE_CAMBIOS_EDITCORE",
    "",
    `_Generado: ${new Date().toISOString()}_`,
    "",
    "## Estado Git",
    "",
    git.available ? `**Rama:** \`${git.branch ?? "detached"}\`` : "_No es repositorio git._",
    "",
  ];

  if (git.available) {
    lines.push(
      "### Archivos",
      "",
      `| Tipo | Cantidad |`,
      `|------|----------|`,
      `| Staged | ${git.staged.length} |`,
      `| Modificados (unstaged) | ${git.unstaged.length} |`,
      `| Sin seguimiento | ${git.untracked.length} |`,
      ""
    );

    if (git.staged.length > 0) {
      lines.push("**Staged:**", ...git.staged.map((f) => `- \`${f}\``), "");
    }
    if (git.unstaged.length > 0) {
      lines.push("**Modificados:**", ...git.unstaged.map((f) => `- \`${f}\``), "");
    }
    if (git.untracked.length > 0) {
      lines.push("**Nuevos:**", ...git.untracked.slice(0, 30).map((f) => `- \`${f}\``), "");
    }

    if (git.diffStat) {
      lines.push("### Diff stat", "", "```", git.diffStat, "```", "");
    }

    if (git.recentCommits.length > 0) {
      lines.push("### Commits recientes", "", ...git.recentCommits.map((c) => `- ${c}`), "");
    }
  }

  if (sessionMeta) {
    lines.push("## Sesión de agentes", "");
    if (sessionMeta.agents?.length) {
      lines.push(`**Agentes:** ${sessionMeta.agents.join(" → ")}`);
    }
    if (sessionMeta.toolCalls !== undefined) {
      lines.push(`**Tool calls:** ${sessionMeta.toolCalls}`);
    }
    if (sessionMeta.tasksCompleted?.length) {
      lines.push("", "**Tareas completadas:**", ...sessionMeta.tasksCompleted.map((t) => `- ${t}`));
    }
    if (sessionMeta.validationPassed !== undefined) {
      lines.push(`**Validación post-cambio:** ${sessionMeta.validationPassed ? "✅ OK" : "❌ Falló"}`);
    }
    lines.push("");
  }

  lines.push(
    "## Reversión",
    "",
    "- `git stash` — guardar cambios sin commit",
    "- `git checkout -- <archivo>` — descartar cambios en archivo",
    "- `git reset --hard HEAD` — **destructivo**, volver al último commit",
    ""
  );

  return lines.join("\n");
}

export async function writeChangeReport(
  root: string,
  markdown: string
): Promise<{ editcorePath: string; repoDocsPath?: string }> {
  const docsDir = path.join(root, ".editcore", "docs");
  await fs.promises.mkdir(docsDir, { recursive: true });
  const editcorePath = path.join(docsDir, "REPORTE_CAMBIOS_EDITCORE.md");
  await fs.promises.writeFile(editcorePath, markdown + "\n", "utf8");

  let repoDocsPath: string | undefined;
  const isEditCoreDev = fs.existsSync(path.join(root, "extensions", "editcore-claude", "package.json"));
  if (isEditCoreDev) {
    const repoDocs = path.join(root, "docs");
    await fs.promises.mkdir(repoDocs, { recursive: true });
    repoDocsPath = path.join(repoDocs, "REPORTE_CAMBIOS_EDITCORE.md");
    await fs.promises.writeFile(repoDocsPath, markdown + "\n", "utf8");
  }

  return { editcorePath, repoDocsPath };
}
