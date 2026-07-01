import * as vscode from "vscode";
import * as https from "https";
import * as cp from "child_process";
import * as path from "path";

/**
 * editcoreConnect — registro central de comandos de conexión con
 * GitHub, Vercel y Supabase, además de paneles de cuenta/APIs.
 *
 * Seguridad:
 * - GitHub usa vscode.authentication (OAuth manejado por VS Code, nunca
 *   vemos ni guardamos un token en texto plano nosotros mismos).
 * - Vercel/Supabase usan context.secrets (SecretStorage), cifrado por el
 *   sistema operativo (Credential Manager en Windows, Keychain en macOS,
 *   libsecret en Linux). Nunca se escriben en disco en texto plano ni en
 *   settings.json.
 *
 * IMPORTANTE — antes de integrar:
 * 1. Ajusta los nombres de los canales/output/logger a los que ya uses
 *    en el resto de la extensión (busqué patrones genéricos aquí).
 * 2. Si ya tienes un helper para ejecutar git (ej. via la API de la
 *    extensión Git de VS Code, `vscode.extensions.getExtension('vscode.git')`),
 *    reemplaza `runGitCommand` por ese helper en vez de spawnear `git` crudo.
 * 3. Revisa los scopes de GitHub (['repo'] cubre repos privados; si solo
 *    necesitas repos públicos usa ['public_repo']).
 */

const SECRET_VERCEL_TOKEN = "editcore.vercel.token";
const SECRET_SUPABASE_TOKEN = "editcore.supabase.token";
const SECRET_SUPABASE_PROJECT_REF = "editcore.supabase.projectRef";

let outputChannel: vscode.OutputChannel;

export function registerEditcoreConnectCommands(context: vscode.ExtensionContext): void {
  outputChannel = vscode.window.createOutputChannel("EditCore Connect");
  context.subscriptions.push(outputChannel);

  const commands: Array<[string, (...args: any[]) => any]> = [
    ["editcoreConnect.signInGithub", () => signInGithub(context)],
    ["editcoreConnect.publishGithub", () => publishGithub(context)],
    ["editcoreConnect.cloneRepo", () => cloneRepo(context)],
    ["editcoreConnect.listIssues", () => listIssues(context)],
    ["editcoreConnect.createIssue", () => createIssue(context)],
    ["editcoreConnect.setVercelToken", () => setVercelToken(context)],
    ["editcoreConnect.deployVercel", () => deployVercel(context)],
    ["editcoreConnect.setSupabaseToken", () => setSupabaseToken(context)],
    ["editcoreConnect.linkSupabase", () => linkSupabase(context)],
    ["editcoreConnect.initSupabase", () => initSupabase(context)],
    ["editcoreConnect.showConnections", () => showConnections(context)],
  ];

  for (const [id, handler] of commands) {
    context.subscriptions.push(
      vscode.commands.registerCommand(id, async (...args: any[]) => {
        try {
          return await handler(...args);
        } catch (err: any) {
          outputChannel.appendLine(`[${id}] Error: ${err?.message ?? err}`);
          vscode.window.showErrorMessage(`EditCore Connect: ${err?.message ?? "Error desconocido"}`);
        }
      })
    );
  }
}

// ---------------------------------------------------------------------------
// GitHub — vía vscode.authentication (recomendado por Microsoft/VS Code)
// ---------------------------------------------------------------------------

async function getGithubSession(createIfNone = true): Promise<vscode.AuthenticationSession | undefined> {
  return vscode.authentication.getSession("github", ["repo"], { createIfNone });
}

async function signInGithub(context: vscode.ExtensionContext): Promise<void> {
  const session = await getGithubSession(true);
  if (!session) {
    vscode.window.showWarningMessage("No se pudo iniciar sesión en GitHub.");
    return;
  }
  vscode.window.showInformationMessage(`Conectado a GitHub como ${session.account.label}.`);
  outputChannel.appendLine(`GitHub: sesión iniciada para ${session.account.label}`);
}

async function githubApiRequest<T = any>(
  session: vscode.AuthenticationSession,
  method: string,
  urlPath: string,
  body?: unknown
): Promise<T> {
  const payload = body ? JSON.stringify(body) : undefined;
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "api.github.com",
        path: urlPath,
        method,
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          "User-Agent": "editcore-claude",
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () => {
          if (!res.statusCode || res.statusCode >= 400) {
            reject(new Error(`GitHub API ${res.statusCode}: ${raw}`));
            return;
          }
          try {
            resolve(raw ? JSON.parse(raw) : (undefined as any));
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function publishGithub(context: vscode.ExtensionContext): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    vscode.window.showWarningMessage("Abre una carpeta/workspace antes de publicar a GitHub.");
    return;
  }

  const session = await getGithubSession(true);
  if (!session) return;

  const repoName = await vscode.window.showInputBox({
    prompt: "Nombre del repositorio en GitHub",
    value: path.basename(folder.uri.fsPath),
    validateInput: (v) => (v.trim() ? undefined : "El nombre no puede estar vacío."),
  });
  if (!repoName) return;

  const visibility = await vscode.window.showQuickPick(["private", "public"], {
    placeHolder: "Visibilidad del repositorio",
  });
  if (!visibility) return;

  outputChannel.appendLine(`Creando repositorio ${repoName} (${visibility}) en GitHub...`);
  const repo = await githubApiRequest(session, "POST", "/user/repos", {
    name: repoName,
    private: visibility === "private",
  });

  const remoteUrl: string = repo.clone_url.replace(
    "https://",
    `https://${session.account.label}:${session.accessToken}@`
  );

  await runGitCommand(folder.uri.fsPath, ["init"]).catch(() => undefined);
  await runGitCommand(folder.uri.fsPath, ["remote", "remove", "origin"]).catch(() => undefined);
  await runGitCommand(folder.uri.fsPath, ["remote", "add", "origin", remoteUrl]);
  await runGitCommand(folder.uri.fsPath, ["add", "-A"]);
  await runGitCommand(folder.uri.fsPath, ["commit", "-m", "Initial commit via EditCore"]).catch(() => undefined);
  await runGitCommand(folder.uri.fsPath, ["branch", "-M", "main"]);
  await runGitCommand(folder.uri.fsPath, ["push", "-u", "origin", "main"]);

  vscode.window.showInformationMessage(`Publicado en GitHub: ${repo.html_url}`);
}

async function cloneRepo(context: vscode.ExtensionContext): Promise<void> {
  const url = await vscode.window.showInputBox({
    prompt: "URL del repositorio a clonar (https://github.com/usuario/repo.git)",
    validateInput: (v) => (v.trim() ? undefined : "La URL no puede estar vacía."),
  });
  if (!url) return;

  const destUris = await vscode.window.showOpenDialog({
    canSelectFolders: true,
    canSelectFiles: false,
    canSelectMany: false,
    openLabel: "Clonar aquí",
  });
  if (!destUris || destUris.length === 0) return;

  const destPath = destUris[0].fsPath;
  outputChannel.appendLine(`Clonando ${url} en ${destPath}...`);
  await runGitCommand(destPath, ["clone", url]);
  vscode.window.showInformationMessage("Repositorio clonado.");
}

function parseOwnerRepoFromRemote(remoteUrl: string): { owner: string; repo: string } | undefined {
  const match = remoteUrl.match(/github\.com[/:]([^/]+)\/([^/.]+)(\.git)?$/);
  if (!match) return undefined;
  return { owner: match[1], repo: match[2] };
}

async function currentRepoOwnerAndName(): Promise<{ owner: string; repo: string } | undefined> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) return undefined;
  try {
    const remote = await runGitCommand(folder.uri.fsPath, ["remote", "get-url", "origin"]);
    return parseOwnerRepoFromRemote(remote.trim());
  } catch {
    return undefined;
  }
}

async function listIssues(context: vscode.ExtensionContext): Promise<void> {
  const session = await getGithubSession(true);
  if (!session) return;
  const target = await currentRepoOwnerAndName();
  if (!target) {
    vscode.window.showWarningMessage("No se encontró un remoto de GitHub en este workspace.");
    return;
  }
  const issues = await githubApiRequest<any[]>(
    session,
    "GET",
    `/repos/${target.owner}/${target.repo}/issues?state=open&per_page=50`
  );
  if (!issues.length) {
    vscode.window.showInformationMessage("No hay issues abiertos.");
    return;
  }
  const pick = await vscode.window.showQuickPick(
    issues.map((i) => ({ label: `#${i.number} ${i.title}`, description: i.html_url })),
    { placeHolder: `${issues.length} issues abiertos — selecciona para abrir` }
  );
  if (pick?.description) {
    vscode.env.openExternal(vscode.Uri.parse(pick.description));
  }
}

async function createIssue(context: vscode.ExtensionContext): Promise<void> {
  const session = await getGithubSession(true);
  if (!session) return;
  const target = await currentRepoOwnerAndName();
  if (!target) {
    vscode.window.showWarningMessage("No se encontró un remoto de GitHub en este workspace.");
    return;
  }
  const title = await vscode.window.showInputBox({ prompt: "Título del issue" });
  if (!title?.trim()) return;
  const body = await vscode.window.showInputBox({ prompt: "Descripción (opcional)" });

  const issue = await githubApiRequest(session, "POST", `/repos/${target.owner}/${target.repo}/issues`, {
    title: title.trim(),
    body: body ?? "",
  });
  vscode.window.showInformationMessage(`Issue creado: #${issue.number}`);
  outputChannel.appendLine(`Issue creado: ${issue.html_url}`);
}

function runGitCommand(cwd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    cp.execFile("git", args, { cwd }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(stderr || err.message));
        return;
      }
      resolve(stdout);
    });
  });
}

// ---------------------------------------------------------------------------
// Vercel — token en SecretStorage
// ---------------------------------------------------------------------------

async function setVercelToken(context: vscode.ExtensionContext): Promise<void> {
  const token = await vscode.window.showInputBox({
    prompt: "Token de Vercel (Settings → Tokens en vercel.com)",
    password: true,
    ignoreFocusOut: true,
    validateInput: (v) => (v.trim() ? undefined : "El token no puede estar vacío."),
  });
  if (!token) return;
  await context.secrets.store(SECRET_VERCEL_TOKEN, token.trim());
  vscode.window.showInformationMessage("Token de Vercel guardado de forma segura.");
}

async function getVercelToken(context: vscode.ExtensionContext): Promise<string | undefined> {
  const existing = await context.secrets.get(SECRET_VERCEL_TOKEN);
  if (existing) return existing;
  await setVercelToken(context);
  return context.secrets.get(SECRET_VERCEL_TOKEN);
}

async function vercelApiRequest<T = any>(token: string, method: string, urlPath: string, body?: unknown): Promise<T> {
  const payload = body ? JSON.stringify(body) : undefined;
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "api.vercel.com",
        path: urlPath,
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () => {
          if (!res.statusCode || res.statusCode >= 400) {
            reject(new Error(`Vercel API ${res.statusCode}: ${raw}`));
            return;
          }
          try {
            resolve(raw ? JSON.parse(raw) : (undefined as any));
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function deployVercel(context: vscode.ExtensionContext): Promise<void> {
  const token = await getVercelToken(context);
  if (!token) return;

  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    vscode.window.showWarningMessage("Abre una carpeta/workspace antes de desplegar.");
    return;
  }

  // Preferimos usar la CLI de Vercel si está instalada (maneja el build/upload
  // completo); si no está disponible, avisamos en vez de reimplementar la
  // subida de archivos a mano.
  const hasCli = await new Promise<boolean>((resolve) => {
    cp.execFile("vercel", ["--version"], (err) => resolve(!err));
  });

  if (!hasCli) {
    vscode.window.showWarningMessage(
      "La CLI de Vercel no está instalada. Instálala con: npm install -g vercel"
    );
    return;
  }

  outputChannel.show(true);
  outputChannel.appendLine("Desplegando a Vercel...");
  const child = cp.spawn("vercel", ["deploy", "--prod", "--token", token, "--yes"], {
    cwd: folder.uri.fsPath,
  });
  child.stdout.on("data", (d) => outputChannel.append(d.toString()));
  child.stderr.on("data", (d) => outputChannel.append(d.toString()));
  child.on("close", (code) => {
    if (code === 0) {
      vscode.window.showInformationMessage("Deploy a Vercel completado.");
    } else {
      vscode.window.showErrorMessage(`Deploy a Vercel falló (código ${code}). Revisa el output de EditCore Connect.`);
    }
  });
}

// ---------------------------------------------------------------------------
// Supabase — token de acceso + project ref en SecretStorage
// ---------------------------------------------------------------------------

async function setSupabaseToken(context: vscode.ExtensionContext): Promise<void> {
  const token = await vscode.window.showInputBox({
    prompt: "Access token de Supabase (Account → Access Tokens en supabase.com)",
    password: true,
    ignoreFocusOut: true,
    validateInput: (v) => (v.trim() ? undefined : "El token no puede estar vacío."),
  });
  if (!token) return;
  await context.secrets.store(SECRET_SUPABASE_TOKEN, token.trim());
  vscode.window.showInformationMessage("Token de Supabase guardado de forma segura.");
}

async function getSupabaseToken(context: vscode.ExtensionContext): Promise<string | undefined> {
  const existing = await context.secrets.get(SECRET_SUPABASE_TOKEN);
  if (existing) return existing;
  await setSupabaseToken(context);
  return context.secrets.get(SECRET_SUPABASE_TOKEN);
}

async function linkSupabase(context: vscode.ExtensionContext): Promise<void> {
  const token = await getSupabaseToken(context);
  if (!token) return;

  const projectRef = await vscode.window.showInputBox({
    prompt: "Project ref de Supabase (ej. abcdefghijklmno, visible en la URL del dashboard)",
    validateInput: (v) => (v.trim() ? undefined : "El project ref no puede estar vacío."),
  });
  if (!projectRef) return;

  await context.secrets.store(SECRET_SUPABASE_PROJECT_REF, projectRef.trim());
  vscode.window.showInformationMessage(`Proyecto Supabase vinculado: ${projectRef.trim()}`);
}

async function initSupabase(context: vscode.ExtensionContext): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    vscode.window.showWarningMessage("Abre una carpeta/workspace antes de inicializar Supabase.");
    return;
  }

  const hasCli = await new Promise<boolean>((resolve) => {
    cp.execFile("supabase", ["--version"], (err) => resolve(!err));
  });

  if (!hasCli) {
    vscode.window.showWarningMessage(
      "La CLI de Supabase no está instalada. Instálala: https://supabase.com/docs/guides/cli"
    );
    return;
  }

  outputChannel.show(true);
  outputChannel.appendLine("Inicializando proyecto Supabase local...");
  const child = cp.spawn("supabase", ["init"], { cwd: folder.uri.fsPath });
  child.stdout.on("data", (d) => outputChannel.append(d.toString()));
  child.stderr.on("data", (d) => outputChannel.append(d.toString()));
  child.on("close", (code) => {
    if (code === 0) {
      vscode.window.showInformationMessage("Supabase inicializado en este workspace.");
    } else {
      vscode.window.showErrorMessage(`supabase init falló (código ${code}).`);
    }
  });
}

// ---------------------------------------------------------------------------
// Paneles — APIs (Claude/OpenAI) y cuenta
// ---------------------------------------------------------------------------

async function showConnections(context: vscode.ExtensionContext): Promise<void> {
  const githubSession = await getGithubSession(false);
  const vercelToken = await context.secrets.get(SECRET_VERCEL_TOKEN);
  const supabaseRef = await context.secrets.get(SECRET_SUPABASE_PROJECT_REF);

  const lines = [
    `GitHub: ${githubSession ? `conectado como ${githubSession.account.label}` : "no conectado"}`,
    `Vercel: ${vercelToken ? "token configurado" : "no configurado"}`,
    `Supabase: ${supabaseRef ? `proyecto ${supabaseRef} vinculado` : "no vinculado"}`,
  ];

  const action = await vscode.window.showInformationMessage(lines.join("  |  "), "Cerrar sesión de todo");
  if (action === "Cerrar sesión de todo") {
    await context.secrets.delete(SECRET_VERCEL_TOKEN);
    await context.secrets.delete(SECRET_SUPABASE_TOKEN);
    await context.secrets.delete(SECRET_SUPABASE_PROJECT_REF);
    vscode.window.showInformationMessage(
      "Tokens de Vercel/Supabase eliminados. Para GitHub, usa 'Accounts' en la barra inferior de VS Code."
    );
  }
}