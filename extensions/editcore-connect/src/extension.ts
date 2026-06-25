import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { exec } from "child_process";
import { promisify } from "util";
import { ConnectPanelProvider } from "./connectPanelProvider";
import { ApiKeysPanelProvider } from "./apiKeysPanelProvider";
import { reloadEditCore } from "./apiActions";
import { registerSidebarActionView } from "./sidebarActionViews";
import { GITHUB_SCOPES, signInGithub } from "./githubAuth";
import {
  createGithubIssue,
  getRepoInfo,
  listGithubIssues,
  listGithubPullRequests,
} from "./githubService";
import {
  openLastVercelDeploy,
  runVercelDeploy,
  showVercelDomainsGuide,
} from "./vercelCommands";
import { getVercelProjectState } from "./vercelService";
import { registerApiCommands } from "./apiCommands";
import { registerGlobalAutoConnect, syncWorkspaceConnect } from "./globalConnect";
import { autoLinkVercelProject } from "./vercelAutoLink";
import { autoLinkSupabaseWorkspace } from "./supabaseAutoLink";
import {
  migrateLegacySupabaseToken,
  addSupabaseAccount,
  hasSupabaseAccounts,
  manageSupabaseAccounts,
  getSupabaseTokenForWorkspace,
} from "./supabaseAccountStore";

const execAsync = promisify(exec);

export function activate(context: vscode.ExtensionContext) {
  const panel = new ConnectPanelProvider(context);

  void migrateLegacySupabaseToken(context);

  const apiKeysPanel = new ApiKeysPanelProvider(context);
  registerApiCommands(context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("editcoreConnect.panel", panel),
    vscode.window.registerWebviewViewProvider("editcoreConnect.apiAction", apiKeysPanel)
  );

  registerSidebarActionView(
    context,
    "editcoreConnect.reloadAction",
    () => reloadEditCore(),
    "Recargar",
    "Recargar cambios",
    "Aplica actualizaciones sin cerrar EditCore.",
    true
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("editcoreConnect.openApis", async () => {
      await vscode.commands.executeCommand("workbench.view.extension.editcore-api-sidebar");
      await vscode.commands.executeCommand("editcoreConnect.apiAction.focus");
    }),
    vscode.commands.registerCommand("editcoreConnect.reloadWindow", () => reloadEditCore())
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("editcoreConnect.setVercelToken", async () => {
      const token = await vscode.window.showInputBox({
        prompt: "Pega el TOKEN SECRETO de Vercel (no el nombre «editcore» — el valor que solo se muestra una vez al crear)",
        placeHolder: "vercel.com/account/settings/tokens → Create → copiar el secreto",
        password: true,
        ignoreFocusOut: true,
      });
      if (!token) return;

      const trimmed = token.trim();
      const { validateVercelAccount } = await import("./vercelAutoLink");
      const check = await validateVercelAccount(trimmed);
      if (!check.ok) {
        await vscode.window.showErrorMessage(
          check.error ??
            "Token rechazado por Vercel. Creá uno nuevo con Scope «Full Account» y copiá el secreto al instante.",
          { modal: true }
        );
        return;
      }

      await context.secrets.store("vercelToken", trimmed);
      vscode.window.showInformationMessage(
        `EditCore: cuenta Vercel conectada (${check.projects.length} proyecto(s) detectados).`
      );
      await syncWorkspaceConnect(context, panel, { silent: false });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("editcoreConnect.signInVercel", async () => {
      await vscode.commands.executeCommand("editcoreConnect.setVercelToken");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("editcoreConnect.clearVercelToken", async () => {
      const ok = await vscode.window.showWarningMessage(
        "¿Desconectar cuenta Vercel de EditCore?",
        { modal: true },
        "Desconectar"
      );
      if (ok !== "Desconectar") return;
      await context.secrets.delete("vercelToken");
      vscode.window.showInformationMessage("EditCore: cuenta Vercel desconectada.");
      await panel.refreshStatus();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("editcoreConnect.addSupabaseAccount", async () => {
      const label = await vscode.window.showInputBox({
        prompt: "Nombre para esta cuenta Supabase (ej: icloud, gmail trabajo)",
        placeHolder: "Cuenta 1",
        ignoreFocusOut: true,
      });
      if (!label?.trim()) return;

      const token = await vscode.window.showInputBox({
        prompt: `Token de Supabase para «${label}» (dashboard/account/tokens)`,
        password: true,
        ignoreFocusOut: true,
      });
      if (!token) return;

      const result = await addSupabaseAccount(context, label, token);
      if (!result.ok) {
        await vscode.window.showErrorMessage(result.error ?? "No se pudo añadir la cuenta.", {
          modal: true,
        });
        return;
      }
      vscode.window.showInformationMessage(
        `Supabase: «${result.account!.label}» añadida (${result.account!.projectCount} proyectos).`
      );
      await syncWorkspaceConnect(context, panel, { silent: false });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("editcoreConnect.setSupabaseToken", async () => {
      await vscode.commands.executeCommand("editcoreConnect.addSupabaseAccount");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("editcoreConnect.signInSupabase", async () => {
      const has = await hasSupabaseAccounts(context);
      if (has) {
        const choice = await vscode.window.showQuickPick(
          [
            { label: "Añadir otra cuenta Supabase", action: "add" },
            { label: "Gestionar cuentas", action: "manage" },
          ],
          { placeHolder: "Supabase — varias cuentas gratis" }
        );
        if (choice?.action === "manage") {
          await manageSupabaseAccounts(context, () => {
            void syncWorkspaceConnect(context, panel, { silent: true });
          });
        } else if (choice?.action === "add") {
          await vscode.commands.executeCommand("editcoreConnect.addSupabaseAccount");
        }
      } else {
        await vscode.commands.executeCommand("editcoreConnect.addSupabaseAccount");
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("editcoreConnect.manageSupabaseAccounts", async () => {
      await manageSupabaseAccounts(context, () => {
        void syncWorkspaceConnect(context, panel, { silent: true });
        void panel.refreshStatus();
      });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("editcoreConnect.clearSupabaseToken", async () => {
      await vscode.commands.executeCommand("editcoreConnect.manageSupabaseAccounts");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("editcoreConnect.syncWorkspace", async () => {
      const hasFolder = Boolean(vscode.workspace.workspaceFolders?.length);
      await syncWorkspaceConnect(context, panel, { silent: !hasFolder });
      if (hasFolder) {
        vscode.window.showInformationMessage("EditCore: carpeta sincronizada con Vercel/Supabase.");
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("editcoreConnect.pickVercelProject", async () => {
      const token = await context.secrets.get("vercelToken");
      const cwd = getWorkspaceRoot();
      if (!token || !cwd) return;
      const link = await autoLinkVercelProject(context, cwd, token, { forcePick: true, silent: false });
      if (link.linked) {
        vscode.window.showInformationMessage(`Vercel: proyecto «${link.projectName}» vinculado.`);
        await refreshVercelPanel(panel, context);
        await panel.refreshStatus();
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("editcoreConnect.pickSupabaseProject", async () => {
      const cwd = getWorkspaceRoot();
      if (!cwd) return;
      const link = await autoLinkSupabaseWorkspace(context, cwd, { forcePick: true, silent: false });
      if (link.linked) {
        const acc = link.accountLabel ? ` (${link.accountLabel})` : "";
        vscode.window.showInformationMessage(`Supabase${acc}: «${link.projectName}» vinculado.`);
        await panel.refreshStatus();
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("editcoreConnect.checkCli", async () => {
      await checkAndReportCli(panel, false);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("editcoreConnect.signInGithub", async () => {
      try {
        const label = await signInGithub();
        vscode.window.showInformationMessage(
          `EditCore Connect: sesión de GitHub activa (${label}).`
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`No se pudo iniciar sesión en GitHub: ${message}`);
      } finally {
        panel.refreshStatus();
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("editcoreConnect.cloneRepo", async () => {
      await vscode.commands.executeCommand("git.clone");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("editcoreConnect.publishGithub", async () => {
      const session = await vscode.authentication.getSession("github", GITHUB_SCOPES, {
        createIfNone: false,
      });
      if (!session) {
        const choice = await vscode.window.showWarningMessage(
          "Inicia sesión en GitHub antes de publicar el repositorio.",
          "Iniciar sesión"
        );
        if (choice === "Iniciar sesión") {
          await vscode.commands.executeCommand("editcoreConnect.signInGithub");
        }
        return;
      }
      await vscode.commands.executeCommand("github.publish");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("editcoreConnect.ghAuthLogin", async () => {
      if (!(await isCliAvailable("gh"))) {
        vscode.window.showWarningMessage(
          "Instala GitHub CLI: winget install GitHub.cli"
        );
        return;
      }
      const terminal = vscode.window.createTerminal({
        name: "EditCore — GitHub CLI Login",
      });
      terminal.show();
      terminal.sendText("gh auth login");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("editcoreConnect.connectVercel", async () => {
      const token = await context.secrets.get("vercelToken");
      if (!token) {
        await vscode.commands.executeCommand("editcoreConnect.signInVercel");
        return;
      }
      if (!getWorkspaceRoot()) return;
      await syncWorkspaceConnect(context, panel, { silent: false });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("editcoreConnect.connectSupabase", async () => {
      const has = await hasSupabaseAccounts(context);
      if (!has) {
        await vscode.commands.executeCommand("editcoreConnect.signInSupabase");
        return;
      }
      if (!getWorkspaceRoot()) return;
      await syncWorkspaceConnect(context, panel, { silent: false });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("editcoreConnect.deployVercel", async () => {
      const token = await context.secrets.get("vercelToken");
      if (!token) {
        const choice = await vscode.window.showWarningMessage(
          "No has configurado tu token de Vercel.",
          "Configurar ahora"
        );
        if (choice === "Configurar ahora") {
          await vscode.commands.executeCommand("editcoreConnect.setVercelToken");
        }
        return;
      }
      const cwd = getWorkspaceRoot();
      if (!cwd) {
        return;
      }
      await syncWorkspaceConnect(context, panel, { silent: true });
      if (!(await isCliAvailable("vercel"))) {
        vscode.window.showWarningMessage("Instala Vercel CLI: npm i -g vercel");
        return;
      }
      await runVercelDeploy(context, cwd, token, { refreshVercel: () => panel.refreshVercel() });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("editcoreConnect.linkVercel", async () => {
      await vscode.commands.executeCommand("editcoreConnect.pickVercelProject");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("editcoreConnect.openVercelPreview", async () => {
      const cwd = getWorkspaceRoot();
      if (!cwd) {
        return;
      }
      await openLastVercelDeploy(context, cwd);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("editcoreConnect.showDomainGuide", async () => {
      const token = await context.secrets.get("vercelToken");
      if (!token) {
        await vscode.commands.executeCommand("editcoreConnect.setVercelToken");
        return;
      }
      const cwd = getWorkspaceRoot();
      if (!cwd) {
        return;
      }
      await showVercelDomainsGuide(context, cwd, token);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("editcoreConnect.refreshVercelStatus", async () => {
      await refreshVercelPanel(panel, context);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("editcoreConnect.linkSupabase", async () => {
      await vscode.commands.executeCommand("editcoreConnect.pickSupabaseProject");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("editcoreConnect.initSupabase", async () => {
      const cwd = getWorkspaceRoot();
      if (!cwd) return;
      const token = await getSupabaseTokenForWorkspace(context, cwd);
      if (!token) {
        const choice = await vscode.window.showWarningMessage(
          "No hay cuenta Supabase para este proyecto.",
          "Añadir cuenta"
        );
        if (choice === "Añadir cuenta") {
          await vscode.commands.executeCommand("editcoreConnect.addSupabaseAccount");
        }
        return;
      }
      const terminal = vscode.window.createTerminal({
        name: "EditCore — Supabase Init",
        cwd,
        env: { SUPABASE_ACCESS_TOKEN: token },
      });
      terminal.show();
      terminal.sendText("supabase init");
    })
  );

  context.subscriptions.push(
    vscode.authentication.onDidChangeSessions((e) => {
      if (e.provider.id === "github") {
        panel.refreshStatus();
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("editcoreConnect.listIssues", async () => {
      const cwd = getWorkspaceRoot();
      if (!cwd) return;
      try {
        const issues = await listGithubIssues(cwd);
        const pick = await vscode.window.showQuickPick(
          issues.map((i) => ({ label: `#${i.number} ${i.title}`, description: i.state, issue: i })),
          { placeHolder: "Issues del repositorio" }
        );
        if (pick?.issue.url) {
          void vscode.env.openExternal(vscode.Uri.parse(pick.issue.url));
        }
      } catch (err: unknown) {
        vscode.window.showErrorMessage(`GitHub issues: ${err instanceof Error ? err.message : String(err)}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("editcoreConnect.listPullRequests", async () => {
      const cwd = getWorkspaceRoot();
      if (!cwd) return;
      try {
        const prs = await listGithubPullRequests(cwd);
        const pick = await vscode.window.showQuickPick(
          prs.map((p) => ({ label: `#${p.number} ${p.title}`, description: p.state, pr: p })),
          { placeHolder: "Pull Requests" }
        );
        if (pick?.pr.url) {
          void vscode.env.openExternal(vscode.Uri.parse(pick.pr.url));
        }
      } catch (err: unknown) {
        vscode.window.showErrorMessage(`GitHub PRs: ${err instanceof Error ? err.message : String(err)}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("editcoreConnect.createIssue", async () => {
      const cwd = getWorkspaceRoot();
      if (!cwd) return;
      const title = await vscode.window.showInputBox({ prompt: "Título del issue" });
      if (!title?.trim()) return;
      const body = (await vscode.window.showInputBox({ prompt: "Descripción (opcional)" })) ?? "";
      try {
        const url = await createGithubIssue(cwd, title, body);
        vscode.window.showInformationMessage(`Issue creado: ${url}`);
      } catch (err: unknown) {
        vscode.window.showErrorMessage(`No se pudo crear issue: ${err instanceof Error ? err.message : String(err)}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("editcoreConnect.refreshGithub", async () => {
      const cwd = getWorkspaceRoot();
      if (!cwd) return;
      try {
        const info = await getRepoInfo(cwd);
        panel.setGithubRepoInfo(info);
        const issues = await listGithubIssues(cwd, 5);
        const prs = await listGithubPullRequests(cwd, 5);
        panel.setGithubLists(
          issues.map((i) => `#${i.number} ${i.title}`).join("\n") || "(ninguno)",
          prs.map((p) => `#${p.number} ${p.title}`).join("\n") || "(ninguno)"
        );
      } catch {
        panel.setGithubLists("", "");
      }
      panel.refreshStatus();
    })
  );

  checkAndReportCli(panel, true).catch(() => void 0);
  panel.refreshStatus();
  void refreshVercelPanel(panel, context);
  registerGlobalAutoConnect(context, panel);
}

async function refreshVercelPanel(
  panel: ConnectPanelProvider,
  context: vscode.ExtensionContext
): Promise<void> {
  const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!cwd) {
    panel.setVercelState({ linked: false });
    return;
  }
  const state = await getVercelProjectState(cwd, context);
  panel.setVercelState(state);
}

interface CliStatus {
  vercel: boolean;
  supabase: boolean;
  git: boolean;
  gh: boolean;
}

async function checkAndReportCli(
  panel: ConnectPanelProvider,
  silent: boolean
): Promise<CliStatus> {
  const status: CliStatus = { vercel: false, supabase: false, git: false, gh: false };

  const checks: Array<[keyof CliStatus, string]> = [
    ["vercel", "vercel --version"],
    ["supabase", "supabase --version"],
    ["git", "git --version"],
    ["gh", "gh --version"],
  ];

  for (const [key, cmd] of checks) {
    status[key] = await isCliAvailable(cmd.split(" ")[0]);
  }

  panel.updateCliStatus(status);

  const missing = Object.entries(status)
    .filter(([, ok]) => !ok)
    .map(([name]) => name);

  if (!silent && missing.length > 0) {
    vscode.window.showWarningMessage(
      `EditCore Connect: faltan estas CLIs: ${missing.join(", ")}. ` +
        `Ve al panel "EditCore Connect" para ver cómo instalarlas.`
    );
  }

  return status;
}

async function isCliAvailable(cmd: string): Promise<boolean> {
  try {
    await execAsync(process.platform === "win32" ? `where ${cmd}` : `which ${cmd}`);
    return true;
  } catch {
    return false;
  }
}

function getWorkspaceRoot(): string | undefined {
  const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!cwd) {
    vscode.window.showWarningMessage("Abre una carpeta de proyecto primero.");
  }
  return cwd;
}

export function deactivate() {}
