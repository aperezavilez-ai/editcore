import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface GhIssue {
  number: number;
  title: string;
  state: string;
  url: string;
}

export interface GhPullRequest {
  number: number;
  title: string;
  state: string;
  url: string;
}

export async function listGithubIssues(cwd: string, limit = 10): Promise<GhIssue[]> {
  const { stdout } = await execAsync(
    `gh issue list --limit ${limit} --json number,title,state,url`,
    { cwd, timeout: 30_000, shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/sh' }
  );
  return JSON.parse(stdout) as GhIssue[];
}

export async function listGithubPullRequests(cwd: string, limit = 10): Promise<GhPullRequest[]> {
  const { stdout } = await execAsync(
    `gh pr list --limit ${limit} --json number,title,state,url`,
    { cwd, timeout: 30_000, shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/sh' }
  );
  return JSON.parse(stdout) as GhPullRequest[];
}

export async function createGithubIssue(
  cwd: string,
  title: string,
  body: string
): Promise<string> {
  const { stdout } = await execAsync(
    `gh issue create --title ${JSON.stringify(title)} --body ${JSON.stringify(body)}`,
    { cwd, timeout: 30_000, shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/sh' }
  );
  return stdout.trim();
}

export async function getRepoInfo(cwd: string): Promise<string | undefined> {
  try {
    const { stdout } = await execAsync('gh repo view --json name,url,defaultBranchRef', {
      cwd,
      timeout: 15_000,
      shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/sh',
    });
    const data = JSON.parse(stdout) as { name: string; url: string; defaultBranchRef?: { name: string } };
    return `${data.name} · ${data.url} · rama ${data.defaultBranchRef?.name ?? 'main'}`;
  } catch {
    return undefined;
  }
}

export async function isGhAvailable(): Promise<boolean> {
  try {
    await execAsync(process.platform === 'win32' ? 'where gh' : 'which gh');
    return true;
  } catch {
    return false;
  }
}
