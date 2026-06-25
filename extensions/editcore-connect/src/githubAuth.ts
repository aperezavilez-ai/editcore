import * as vscode from "vscode";

const GITHUB_SCOPES = ["repo", "read:user", "workflow"];

export async function getGithubSessionLabel(): Promise<string | undefined> {
  const session = await vscode.authentication.getSession("github", GITHUB_SCOPES, {
    createIfNone: false,
  });
  return session?.account.label;
}

export async function signInGithub(): Promise<string | undefined> {
  const session = await vscode.authentication.getSession("github", GITHUB_SCOPES, {
    createIfNone: true,
  });
  return session.account.label;
}

export { GITHUB_SCOPES };
