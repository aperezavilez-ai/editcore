import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface WorkspaceHints {
  folderName: string;
  packageName?: string;
  gitRepoName?: string;
  gitRemoteSlug?: string;
  all: string[];
}

/** Normaliza remote GitHub a "owner/repo" en minúsculas. */
export function normalizeGithubSlug(input: string): string | undefined {
  const s = input.trim().toLowerCase();
  const ssh = s.match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
  if (ssh) return ssh[1];
  const https = s.match(/github\.com\/([^/]+\/[^/]+?)(?:\.git)?$/);
  if (https) return https[1];
  if (/^[^/]+\/[^/]+$/.test(s)) return s;
  return undefined;
}

export async function getWorkspaceHints(cwd: string): Promise<WorkspaceHints> {
  const folderName = path.basename(cwd);
  const hints = new Set<string>([folderName]);

  const pkgPath = path.join(cwd, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as { name?: string };
      if (pkg.name) {
        const short = pkg.name.split("/").pop() ?? pkg.name;
        hints.add(short);
        hints.add(pkg.name);
      }
    } catch {
      // ignore
    }
  }

  let gitRepoName: string | undefined;
  let gitRemoteSlug: string | undefined;
  try {
    const { stdout } = await execAsync("git remote get-url origin", {
      cwd,
      timeout: 8000,
      shell: process.platform === "win32" ? "cmd.exe" : "/bin/sh",
    });
    const url = stdout.trim();
    gitRemoteSlug = normalizeGithubSlug(url);
    const m = url.match(/\/([^/]+?)(?:\.git)?$/);
    if (m) {
      gitRepoName = m[1];
      hints.add(gitRepoName);
    }
    if (gitRemoteSlug) {
      hints.add(gitRemoteSlug.split("/").pop() ?? "");
      hints.add(gitRemoteSlug.replace("/", "-"));
    }
  } catch {
    // no git
  }

  return {
    folderName,
    packageName: [...hints].find((h) => h !== folderName),
    gitRepoName,
    gitRemoteSlug,
    all: [...hints].filter(Boolean),
  };
}

export function scoreNameMatch(projectName: string, hints: string[]): number {
  const n = projectName.toLowerCase().replace(/[_\s-]/g, "");
  let best = 0;
  for (const h of hints) {
    const hl = h.toLowerCase().replace(/[_\s-]/g, "");
    if (!hl) continue;
    if (n === hl) best = Math.max(best, 100);
    else if (n.includes(hl) || hl.includes(n)) best = Math.max(best, 60);
    else if (n.startsWith(hl) || hl.startsWith(n)) best = Math.max(best, 40);
  }
  return best;
}
