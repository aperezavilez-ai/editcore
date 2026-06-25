import * as vscode from "vscode";
import { GITHUB_SCOPES } from "./githubAuth";
import {
  getRemoteFromGit,
  parseGithubRemote,
  listWorkflowRuns,
  listPullRequestsApi,
} from "./api/githubApi";
import {
  listVercelDeployments,
  listVercelEnvVars,
  rollbackVercelDeployment,
} from "./api/vercelApi";
import { listSupabaseProjects, listSupabaseSecrets } from "./api/supabaseApi";
import { listCloudflareZones, listDnsRecords } from "./api/cloudflareApi";
import {
  isDockerAvailable,
  listContainers,
  dockerComposeUp,
  dockerComposeDown,
} from "./api/dockerService";
import { detectDatabaseFromWorkspace } from "./api/dbClients";
import { getVercelProjectState } from "./vercelService";

async function getGithubToken(): Promise<string | undefined> {
  const session = await vscode.authentication.getSession("github", GITHUB_SCOPES, {
    createIfNone: false,
  });
  return session?.accessToken;
}

export function registerApiCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("editcoreConnect.apiListWorkflows", async () => {
      const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      const token = await getGithubToken();
      if (!root || !token) {
        vscode.window.showWarningMessage("Necesitás workspace y sesión GitHub.");
        return;
      }
      const remote = await getRemoteFromGit(root);
      const parsed = remote ? parseGithubRemote(remote) : undefined;
      if (!parsed) return;
      const runs = await listWorkflowRuns(token, parsed.owner, parsed.repo);
      const msg = runs.length
        ? runs.map((r) => `${r.name}: ${r.status}/${r.conclusion ?? "-"}`).join("\n")
        : "Sin workflow runs recientes";
      await vscode.window.showInformationMessage(msg, { modal: true });
    }),

    vscode.commands.registerCommand("editcoreConnect.apiListPrs", async () => {
      const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      const token = await getGithubToken();
      if (!root || !token) return;
      const remote = await getRemoteFromGit(root);
      const parsed = remote ? parseGithubRemote(remote) : undefined;
      if (!parsed) return;
      const prs = await listPullRequestsApi(token, parsed.owner, parsed.repo);
      const msg = prs.length ? prs.map((p) => `#${p.number} ${p.title}`).join("\n") : "Sin PRs abiertos";
      await vscode.window.showInformationMessage(msg, { modal: true });
    }),

    vscode.commands.registerCommand("editcoreConnect.apiVercelDeployments", async () => {
      const token = await context.secrets.get("vercelToken");
      const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!token || !root) return;
      const state = await getVercelProjectState(root, context);
      if (!state.projectId) {
        vscode.window.showWarningMessage("Proyecto Vercel no vinculado.");
        return;
      }
      const deps = await listVercelDeployments(token, state.projectId, state.orgId);
      const msg = deps.map((d) => `${d.url} — ${d.state}`).join("\n") || "Sin deployments";
      await vscode.window.showInformationMessage(msg, { modal: true });
    }),

    vscode.commands.registerCommand("editcoreConnect.apiVercelEnv", async () => {
      const token = await context.secrets.get("vercelToken");
      const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!token || !root) return;
      const state = await getVercelProjectState(root, context);
      if (!state.projectId) return;
      const envs = await listVercelEnvVars(token, state.projectId, state.orgId);
      const msg = envs.map((e) => e.key).join(", ") || "Sin variables";
      await vscode.window.showInformationMessage(`Env Vercel: ${msg}`, { modal: true });
    }),

    vscode.commands.registerCommand("editcoreConnect.apiVercelRollback", async () => {
      const token = await context.secrets.get("vercelToken");
      const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!token || !root) return;
      const state = await getVercelProjectState(root, context);
      if (!state.projectId) return;
      const deps = await listVercelDeployments(token, state.projectId, state.orgId, 3);
      const pick = await vscode.window.showQuickPick(
        deps.map((d) => ({ label: d.url, description: d.state, deployment: d })),
        { placeHolder: "Deployment para rollback" }
      );
      if (!pick) return;
      const result = await rollbackVercelDeployment(token, pick.deployment.uid, state.orgId);
      vscode.window.showInformationMessage(result.message);
    }),

    vscode.commands.registerCommand("editcoreConnect.apiListSupabaseProjects", async () => {
      const token = await context.secrets.get("supabaseToken");
      if (!token) return;
      const projects = await listSupabaseProjects(token);
      const msg = projects.map((p) => `${p.name} (${p.region})`).join("\n") || "Sin proyectos";
      await vscode.window.showInformationMessage(msg, { modal: true });
    }),

    vscode.commands.registerCommand("editcoreConnect.apiSupabaseSecrets", async () => {
      const token = await context.secrets.get("supabaseToken");
      const ref = await vscode.window.showInputBox({ prompt: "Project ref de Supabase" });
      if (!token || !ref) return;
      const secrets = await listSupabaseSecrets(token, ref);
      await vscode.window.showInformationMessage(`Secrets: ${secrets.join(", ") || "ninguno"}`, {
        modal: true,
      });
    }),

    vscode.commands.registerCommand("editcoreConnect.setCloudflareToken", async () => {
      const token = await vscode.window.showInputBox({
        prompt: "Cloudflare API Token",
        password: true,
      });
      if (token) {
        await context.secrets.store("cloudflareToken", token);
        vscode.window.showInformationMessage("Token Cloudflare guardado.");
      }
    }),

    vscode.commands.registerCommand("editcoreConnect.apiCloudflareZones", async () => {
      const token = await context.secrets.get("cloudflareToken");
      if (!token) {
        await vscode.commands.executeCommand("editcoreConnect.setCloudflareToken");
        return;
      }
      const zones = await listCloudflareZones(token);
      const pick = await vscode.window.showQuickPick(
        zones.map((z) => ({ label: z.name, description: z.status, zone: z })),
        { placeHolder: "Zona DNS" }
      );
      if (!pick) return;
      const records = await listDnsRecords(token, pick.zone.id);
      const msg = records.map((r) => `${r.type} ${r.name} → ${r.content}`).join("\n") || "Sin registros";
      await vscode.window.showInformationMessage(msg, { modal: true });
    }),

    vscode.commands.registerCommand("editcoreConnect.dockerStatus", async () => {
      const ok = await isDockerAvailable();
      if (!ok) {
        vscode.window.showWarningMessage("Docker no disponible.");
        return;
      }
      const containers = await listContainers(true);
      const msg = containers.map((c) => `${c.name}: ${c.status}`).join("\n") || "Sin contenedores";
      await vscode.window.showInformationMessage(msg, { modal: true });
    }),

    vscode.commands.registerCommand("editcoreConnect.dockerComposeUp", async () => {
      const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!root) return;
      const out = await dockerComposeUp(root);
      vscode.window.showInformationMessage(out.slice(-200) || "Compose up ejecutado");
    }),

    vscode.commands.registerCommand("editcoreConnect.dockerComposeDown", async () => {
      const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!root) return;
      const out = await dockerComposeDown(root);
      vscode.window.showInformationMessage(out.slice(-200) || "Compose down ejecutado");
    }),

    vscode.commands.registerCommand("editcoreConnect.checkDatabases", async () => {
      const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!root) return;
      const dbs = await detectDatabaseFromWorkspace(root);
      const msg = dbs.length
        ? dbs.map((d) => `${d.kind}: ${d.message}`).join("\n")
        : "Sin bases de datos detectadas";
      await vscode.window.showInformationMessage(msg, { modal: true });
    })
  );
}
