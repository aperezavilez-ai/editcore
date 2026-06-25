import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import * as vscode from "vscode";

const execAsync = promisify(exec);
const VERCEL_URL_REGEX = /https:\/\/[a-z0-9][-a-z0-9.]*\.vercel\.app[^\s)"']*/gi;

function deployStorageKey(root: string): string {
  return `vercelLastDeploy:${root.toLowerCase()}`;
}

export interface VercelProjectState {
  linked: boolean;
  projectId?: string;
  projectName?: string;
  orgId?: string;
  lastDeployUrl?: string;
}

export async function getVercelProjectState(
  root: string,
  context?: vscode.ExtensionContext
): Promise<VercelProjectState> {
  const projectJson = path.join(root, ".vercel", "project.json");
  let linked = false;
  let projectId: string | undefined;
  let projectName: string | undefined;
  let orgId: string | undefined;

  if (fs.existsSync(projectJson)) {
    try {
      const raw = JSON.parse(fs.readFileSync(projectJson, "utf8")) as {
        projectId?: string;
        projectName?: string;
        orgId?: string;
      };
      linked = Boolean(raw.projectId);
      projectId = raw.projectId;
      projectName = raw.projectName;
      orgId = raw.orgId;
    } catch {
      linked = false;
    }
  }

  const lastDeployUrl = context?.workspaceState.get<string>(deployStorageKey(root));

  return {
    linked,
    projectId,
    projectName,
    orgId,
    lastDeployUrl,
  };
}

export async function storeLastDeployUrl(
  context: vscode.ExtensionContext,
  root: string,
  url: string
): Promise<void> {
  await context.workspaceState.update(deployStorageKey(root), url);
}

export async function openIntegratedBrowser(url: string): Promise<void> {
  let origin: string | undefined;
  try {
    origin = new URL(url).origin;
  } catch {
    origin = undefined;
  }
  await vscode.commands.executeCommand("workbench.action.browser.open", {
    url,
    reuseUrlFilter: origin ?? url,
  });
}

export function extractVercelUrls(output: string): string[] {
  const matches = output.match(VERCEL_URL_REGEX) ?? [];
  return [...new Set(matches.map((u) => u.replace(/[.,;]+$/, "")))];
}

export async function deployToVercel(
  cwd: string,
  token: string,
  production = false
): Promise<{ stdout: string; stderr: string; urls: string[] }> {
  const flag = production ? " --prod" : "";
  const cmd = `vercel deploy --yes${flag}`;
  const { stdout, stderr } = await execAsync(cmd, {
    cwd,
    env: { ...process.env, VERCEL_TOKEN: token },
    timeout: 600_000,
    maxBuffer: 4 * 1024 * 1024,
    shell: process.platform === "win32" ? "cmd.exe" : "/bin/sh",
  });
  const combined = `${stdout}\n${stderr}`;
  return { stdout, stderr, urls: extractVercelUrls(combined) };
}

export async function listVercelDomains(
  cwd: string,
  token: string
): Promise<string[]> {
  try {
    const { stdout } = await execAsync("vercel domains ls", {
      cwd,
      env: { ...process.env, VERCEL_TOKEN: token },
      timeout: 60_000,
      shell: process.platform === "win32" ? "cmd.exe" : "/bin/sh",
    });
    const lines = stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const domains: string[] = [];
    for (const line of lines) {
      const match = line.match(/^([a-z0-9][-a-z0-9.]+\.[a-z]{2,})/i);
      if (match) {
        domains.push(match[1]);
      }
    }
    return [...new Set(domains)];
  } catch {
    return [];
  }
}

export async function inspectVercelProject(
  cwd: string,
  token: string
): Promise<string | undefined> {
  try {
    const { stdout, stderr } = await execAsync("vercel inspect --yes", {
      cwd,
      env: { ...process.env, VERCEL_TOKEN: token },
      timeout: 60_000,
      shell: process.platform === "win32" ? "cmd.exe" : "/bin/sh",
    });
    const urls = extractVercelUrls(`${stdout}\n${stderr}`);
    return urls[0];
  } catch {
    return undefined;
  }
}
