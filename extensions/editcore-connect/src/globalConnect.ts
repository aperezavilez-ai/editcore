import * as vscode from "vscode";
import { autoLinkVercelProject, validateVercelAccount } from "./vercelAutoLink";
import { autoLinkSupabaseWorkspace } from "./supabaseAutoLink";
import {
  migrateLegacySupabaseToken,
  listSupabaseAccounts,
  getWorkspaceAccountId,
} from "./supabaseAccountStore";
import type { ConnectPanelProvider } from "./connectPanelProvider";

export interface GlobalConnectStatus {
  vercelAccountOk: boolean;
  supabaseAccountOk: boolean;
  vercelProjectName?: string;
  supabaseProjectName?: string;
  workspaceLinkedVercel: boolean;
  workspaceLinkedSupabase: boolean;
  hasWorkspace: boolean;
  vercelProjectCount: number;
  supabaseAccountCount: number;
  supabaseAccountLabel?: string;
}

export async function syncWorkspaceConnect(
  context: vscode.ExtensionContext,
  panel: ConnectPanelProvider,
  options: { silent?: boolean } = {}
): Promise<GlobalConnectStatus> {
  const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const hasWorkspace = Boolean(cwd);
  const vercelToken = await context.secrets.get("vercelToken");
  await migrateLegacySupabaseToken(context);
  const supabaseAccounts = await listSupabaseAccounts(context);

  let vercelAccountOk = false;
  let supabaseAccountOk = false;
  let vercelProjectName: string | undefined;
  let supabaseProjectName: string | undefined;
  let workspaceLinkedVercel = false;
  let workspaceLinkedSupabase = false;
  let vercelProjectCount = 0;
  let supabaseAccountCount = supabaseAccounts.length;
  let supabaseAccountLabel: string | undefined;

  if (vercelToken) {
    const acc = await validateVercelAccount(vercelToken);
    vercelAccountOk = acc.ok;
    vercelProjectCount = acc.projects.length;
    if (!acc.ok && !options.silent && acc.error) {
      vscode.window.showErrorMessage(`EditCore Vercel: ${acc.error}`);
    }
    if (cwd && vercelAccountOk) {
      const link = await autoLinkVercelProject(context, cwd, vercelToken, {
        silent: options.silent ?? true,
      });
      workspaceLinkedVercel = link.linked;
      vercelProjectName = link.projectName;
      if (!options.silent && link.message && !link.linked) {
        vscode.window.showInformationMessage(`EditCore Vercel: ${link.message}`);
      }
    }
  }

  supabaseAccountOk = supabaseAccountCount > 0;
  if (cwd && supabaseAccountOk) {
    const accountId = await getWorkspaceAccountId(context, cwd);
    if (accountId) {
      supabaseAccountLabel = supabaseAccounts.find((a) => a.id === accountId)?.label;
    }
    const link = await autoLinkSupabaseWorkspace(context, cwd, {
      silent: options.silent ?? true,
    });
    workspaceLinkedSupabase = link.linked;
    supabaseProjectName = link.projectName;
    supabaseAccountLabel = link.accountLabel ?? supabaseAccountLabel;
    if (!options.silent && link.message && !link.linked) {
      vscode.window.showInformationMessage(`EditCore Supabase: ${link.message}`);
    }
  }

  const status: GlobalConnectStatus = {
    vercelAccountOk,
    supabaseAccountOk,
    vercelProjectName,
    supabaseProjectName,
    workspaceLinkedVercel,
    workspaceLinkedSupabase,
    hasWorkspace,
    vercelProjectCount,
    supabaseAccountCount,
    supabaseAccountLabel,
  };

  panel.setGlobalStatus(status);
  await panel.refreshStatus();
  void vscode.commands.executeCommand("editcoreConnect.refreshVercelStatus");

  return status;
}

export function registerGlobalAutoConnect(
  context: vscode.ExtensionContext,
  panel: ConnectPanelProvider
): void {
  const run = (silent = true) => {
    const enabled = vscode.workspace
      .getConfiguration("editcoreConnect")
      .get<boolean>("autoLinkOnOpen", true);
    if (!enabled) return;
    void syncWorkspaceConnect(context, panel, { silent });
  };

  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => run(true))
  );

  if (vscode.workspace.workspaceFolders?.length) {
    setTimeout(() => run(true), 800);
  }
}
