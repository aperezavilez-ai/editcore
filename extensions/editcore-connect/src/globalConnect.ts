import * as vscode from "vscode";
import { autoLinkVercelProject } from "./vercelAutoLink";
import { autoLinkSupabaseProject } from "./supabaseAutoLink";
import { validateVercelAccount } from "./vercelAutoLink";
import { validateSupabaseAccount } from "./supabaseAutoLink";
import type { ConnectPanelProvider } from "./connectPanelProvider";

export interface GlobalConnectStatus {
  vercelAccountOk: boolean;
  supabaseAccountOk: boolean;
  vercelProjectName?: string;
  supabaseProjectName?: string;
  workspaceLinkedVercel: boolean;
  workspaceLinkedSupabase: boolean;
}

export async function syncWorkspaceConnect(
  context: vscode.ExtensionContext,
  panel: ConnectPanelProvider,
  options: { silent?: boolean } = {}
): Promise<GlobalConnectStatus> {
  const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const vercelToken = await context.secrets.get("vercelToken");
  const supabaseToken = await context.secrets.get("supabaseToken");

  let vercelAccountOk = false;
  let supabaseAccountOk = false;
  let vercelProjectName: string | undefined;
  let supabaseProjectName: string | undefined;
  let workspaceLinkedVercel = false;
  let workspaceLinkedSupabase = false;

  if (vercelToken) {
    const acc = await validateVercelAccount(vercelToken);
    vercelAccountOk = acc.ok;
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

  if (supabaseToken) {
    const acc = await validateSupabaseAccount(supabaseToken);
    supabaseAccountOk = acc.ok;
    if (cwd && supabaseAccountOk) {
      const link = await autoLinkSupabaseProject(context, cwd, supabaseToken, {
        silent: options.silent ?? true,
      });
      workspaceLinkedSupabase = link.linked;
      supabaseProjectName = link.projectName;
    }
  }

  const status: GlobalConnectStatus = {
    vercelAccountOk,
    supabaseAccountOk,
    vercelProjectName,
    supabaseProjectName,
    workspaceLinkedVercel,
    workspaceLinkedSupabase,
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
