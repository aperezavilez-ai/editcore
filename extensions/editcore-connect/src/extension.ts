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

const execAsync = promisify(exec);

export function activate(context: vscode.ExtensionContext) {
  const panel = new ConnectPanelProvider(context);

  const apiKeysPanel = new ApiKeysPanelProvider(context);

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
        prompt: "Pega tu Vercel Access Token (vercel.com/account/tokens)",
        password: true,
        ignoreFocusOut: true,
      });
      if (token) {
        await context.secrets.store("vercelToken", token);
        vscode.window.showInformationMessage("EditCore Connect: token de Vercel guardado.");
        panel.refreshStatus();
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("editcoreConnect.setSupabaseToken", async () => {
      const token = await vscode.window.showInputBox({
        prompt: "Pega tu Supabase Access Token (supabase.com/dashboard/account/tokens)",
        password: true,
        ignoreFocusOut: true,
      });
      if (token) {
        await context.secrets.store("supabaseToken", token);
        vscode.window.showInformationMessage("EditCore Connect: token de Supabase guardado.");
        panel.refreshStatus();
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
      if (!(await isCliAvailable("vercel"))) {
        vscode.window.showWarningMessage("Instala Vercel CLI: npm i -g vercel");
        return;
      }
      const terminal = vscode.window.createTerminal({
        name: "EditCore — Vercel Deploy",
        cwd,
        env: { VERCEL_TOKEN: token },
      });
      terminal.show();
      terminal.sendText("vercel --yes");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("editcoreConnect.linkSupabase", async () => {
      const token = await context.secrets.get("supabaseToken");
      if (!token) {
        const choice = await vscode.window.showWarningMessage(
          "No has configurado tu token de Supabase.",
          "Configurar ahora"
        );
        if (choice === "Configurar ahora") {
          await vscode.commands.executeCommand("editcoreConnect.setSupabaseToken");
        }
        return;
      }
      const cwd = getWorkspaceRoot();
      if (!cwd) {
        return;
      }
      if (!(await isCliAvailable("supabase"))) {
        vscode.window.showWarningMessage("Instala Supabase CLI: npm i -g supabase");
        return;
      }
      const terminal = vscode.window.createTerminal({
        name: "EditCore — Supabase Link",
        cwd,
        env: { SUPABASE_ACCESS_TOKEN: token },
      });
      terminal.show();
      terminal.sendText("supabase link");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("editcoreConnect.initSupabase", async () => {
      const token = await context.secrets.get("supabaseToken");
      if (!token) {
        const choice = await vscode.window.showWarningMessage(
          "No has configurado tu token de Supabase.",
          "Configurar ahora"
        );
        if (choice === "Configurar ahora") {
          await vscode.commands.executeCommand("editcoreConnect.setSupabaseToken");
        }
        return;
      }
      const cwd = getWorkspaceRoot();
      if (!cwd) {
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
