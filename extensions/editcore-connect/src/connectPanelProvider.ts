import * as vscode from "vscode";
import { getGithubSessionLabel } from "./githubAuth";

interface CliStatus {
  vercel: boolean;
  supabase: boolean;
  git: boolean;
  gh: boolean;
}

interface PanelStatus {
  hasVercelToken: boolean;
  hasSupabaseToken: boolean;
  githubAccount?: string;
  githubRepo?: string;
  githubIssues?: string;
  githubPrs?: string;
}

export class ConnectPanelProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private cliStatus: CliStatus = { vercel: false, supabase: false, git: false, gh: false };
  private githubRepo?: string;
  private githubIssues = "";
  private githubPrs = "";

  constructor(private readonly context: vscode.ExtensionContext) {}

  setGithubRepoInfo(info?: string) {
    this.githubRepo = info;
  }

  setGithubLists(issues: string, prs: string) {
    this.githubIssues = issues;
    this.githubPrs = prs;
    this.render();
  }

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    this.render();

    webviewView.webview.onDidReceiveMessage(async (msg) => {
      switch (msg.type) {
        case "setVercelToken":
          vscode.commands.executeCommand("editcoreConnect.setVercelToken");
          break;
        case "setSupabaseToken":
          vscode.commands.executeCommand("editcoreConnect.setSupabaseToken");
          break;
        case "deployVercel":
          vscode.commands.executeCommand("editcoreConnect.deployVercel");
          break;
        case "linkSupabase":
          vscode.commands.executeCommand("editcoreConnect.linkSupabase");
          break;
        case "initSupabase":
          vscode.commands.executeCommand("editcoreConnect.initSupabase");
          break;
        case "recheckCli":
          vscode.commands.executeCommand("editcoreConnect.checkCli");
          break;
        case "signInGithub":
          vscode.commands.executeCommand("editcoreConnect.signInGithub");
          break;
        case "cloneRepo":
          vscode.commands.executeCommand("editcoreConnect.cloneRepo");
          break;
        case "publishGithub":
          vscode.commands.executeCommand("editcoreConnect.publishGithub");
          break;
        case "ghAuthLogin":
          vscode.commands.executeCommand("editcoreConnect.ghAuthLogin");
          break;
        case "listIssues":
          vscode.commands.executeCommand("editcoreConnect.listIssues");
          break;
        case "listPRs":
          vscode.commands.executeCommand("editcoreConnect.listPullRequests");
          break;
        case "createIssue":
          vscode.commands.executeCommand("editcoreConnect.createIssue");
          break;
        case "refreshGithub":
          vscode.commands.executeCommand("editcoreConnect.refreshGithub");
          break;
        case "warRoom":
          vscode.commands.executeCommand("editcore.warRoom");
          break;
        case "deployAutonomous":
          vscode.commands.executeCommand("editcore.deployAutonomous");
          break;
        case "openMarketplace":
          vscode.commands.executeCommand("editcore.openMarketplace");
          break;
        case "commandHub":
          vscode.commands.executeCommand("editcore.commandHub");
          break;
      }
    });
  }

  updateCliStatus(status: CliStatus) {
    this.cliStatus = status;
    this.render();
  }

  async refreshStatus() {
    const hasVercel = !!(await this.context.secrets.get("vercelToken"));
    const hasSupabase = !!(await this.context.secrets.get("supabaseToken"));
    const githubAccount = await getGithubSessionLabel();
    await this.render({
      hasVercelToken: hasVercel,
      hasSupabaseToken: hasSupabase,
      githubAccount,
    });
  }

  private async render(status?: PanelStatus) {
    if (!this.view) return;
    const hasVercel = status?.hasVercelToken ?? !!(await this.context.secrets.get("vercelToken"));
    const hasSupabase = status?.hasSupabaseToken ?? !!(await this.context.secrets.get("supabaseToken"));
    const githubAccount = status?.githubAccount ?? (await getGithubSessionLabel());
    this.view.webview.html = this.getHtml(
      hasVercel,
      hasSupabase,
      githubAccount,
      this.githubRepo,
      this.githubIssues,
      this.githubPrs
    );
  }

  private badge(ok: boolean, labelOk: string, labelBad: string): string {
    return ok
      ? `<span class="badge ok">${labelOk}</span>`
      : `<span class="badge bad">${labelBad}</span>`;
  }

  private getHtml(
    vToken: boolean,
    sToken: boolean,
    githubAccount?: string,
    githubRepo?: string,
    githubIssues?: string,
    githubPrs?: string
  ): string {
    const cli = this.cliStatus;
    const githubSignedIn = Boolean(githubAccount);
    return /* html */ `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground);
    background: var(--vscode-sideBar-background); margin:0; padding:14px; font-size:13px; }
  h3 { font-size:12px; text-transform:uppercase; letter-spacing:0.5px; opacity:0.65; margin:18px 0 8px; }
  h3:first-child { margin-top:0; }
  .card { background: var(--vscode-editor-inactiveSelectionBackground); border-radius:8px;
    padding:12px; margin-bottom:10px; }
  .row { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; gap:8px; }
  .row:last-child { margin-bottom:0; }
  .name { font-weight:600; }
  .badge { font-size:11px; padding:2px 8px; border-radius:10px; white-space:nowrap; }
  .badge.ok { background: rgba(50,180,90,0.18); color:#3fb950; }
  .badge.bad { background: rgba(220,80,80,0.18); color:#e5534b; }
  button { font-size:12px; background: var(--vscode-button-background); color: var(--vscode-button-foreground);
    border:none; border-radius:4px; padding:6px 10px; cursor:pointer; width:100%; margin-top:6px; }
  button:hover { background: var(--vscode-button-hoverBackground); }
  button.secondary { background:none; border:1px solid var(--vscode-button-border, var(--vscode-panel-border)); color: var(--vscode-foreground); }
  button:disabled { opacity:0.45; cursor:not-allowed; }
  .hint { font-size:11px; opacity:0.6; margin-top:8px; line-height:1.5; }
  code { background: var(--vscode-textCodeBlock-background); padding:1px 5px; border-radius:3px; }
  .account { font-size:11px; opacity:0.85; text-align:right; overflow:hidden; text-overflow:ellipsis; }
</style>
</head>
<body>

  <h3>Herramientas del sistema</h3>
  <div class="card">
    <div class="row"><span class="name">Git</span>${this.badge(cli.git, "Instalado", "Falta")}</div>
    <div class="row"><span class="name">GitHub CLI</span>${this.badge(cli.gh, "Instalado", "Falta")}</div>
    <div class="row"><span class="name">Vercel CLI</span>${this.badge(cli.vercel, "Instalado", "Falta")}</div>
    <div class="row"><span class="name">Supabase CLI</span>${this.badge(cli.supabase, "Instalado", "Falta")}</div>
    <button class="secondary" onclick="send('recheckCli')">Volver a verificar</button>
    ${
      !cli.vercel || !cli.supabase || !cli.gh || !cli.git
        ? `<div class="hint">Instala lo que falte:<br>
           ${!cli.git ? "<code>winget install Git.Git</code><br>" : ""}
           ${!cli.gh ? "<code>winget install GitHub.cli</code><br>" : ""}
           ${!cli.vercel ? "<code>npm i -g vercel</code><br>" : ""}
           ${!cli.supabase ? "<code>npm i -g supabase</code>" : ""}
           </div>`
        : ""
    }
  </div>

  <h3>GitHub</h3>
  <div class="card">
    <div class="row">
      <span class="name">Cuenta IDE</span>
      ${githubSignedIn ? `<span class="account">${escapeHtml(githubAccount!)}</span>` : this.badge(false, "", "Sin sesión")}
    </div>
    <div class="row"><span class="name">Extensión GitHub</span>${this.badge(true, "Incluida", "Falta")}</div>
    <button onclick="send('signInGithub')">${githubSignedIn ? "Renovar sesión GitHub" : "Iniciar sesión en GitHub"}</button>
    <button class="secondary" onclick="send('cloneRepo')">Clonar repositorio</button>
    <button class="secondary" onclick="send('publishGithub')" ${!githubSignedIn ? "disabled" : ""}>Publicar repo en GitHub</button>
    <button class="secondary" onclick="send('ghAuthLogin')" ${!cli.gh ? "disabled" : ""}>gh auth login (CLI)</button>
    <button class="secondary" onclick="send('refreshGithub')" ${!cli.gh ? "disabled" : ""}>Actualizar repo (gh)</button>
    <button class="secondary" onclick="send('listIssues')" ${!cli.gh ? "disabled" : ""}>Ver issues</button>
    <button class="secondary" onclick="send('listPRs')" ${!cli.gh ? "disabled" : ""}>Ver pull requests</button>
    <button class="secondary" onclick="send('createIssue')" ${!cli.gh ? "disabled" : ""}>Crear issue</button>
    ${githubRepo ? `<div class="hint">Repo: ${escapeHtml(githubRepo)}</div>` : ""}
    ${githubIssues ? `<div class="hint">Issues recientes:<br><pre style="white-space:pre-wrap;font-size:11px">${escapeHtml(githubIssues)}</pre></div>` : ""}
    ${githubPrs ? `<div class="hint">PRs recientes:<br><pre style="white-space:pre-wrap;font-size:11px">${escapeHtml(githubPrs)}</pre></div>` : ""}
    <div class="hint">La extensión <code>vscode.github</code> y autenticación OAuth vienen integradas en EditCore. Los tokens se guardan en el llavero del sistema.</div>
  </div>

  <h3>Vercel</h3>
  <div class="card">
    <div class="row"><span class="name">Token</span>${this.badge(vToken, "Configurado", "Sin configurar")}</div>
    <button onclick="send('setVercelToken')">${vToken ? "Cambiar token" : "Configurar token"}</button>
    <button class="secondary" onclick="send('deployVercel')" ${!vToken || !cli.vercel ? "disabled" : ""}>Deploy a Vercel</button>
    <div class="hint">Token en <a href="https://vercel.com/account/tokens">vercel.com/account/tokens</a>. Se usa vía <code>VERCEL_TOKEN</code> sin exponerlo en la terminal.</div>
  </div>

  <h3>Supabase</h3>
  <div class="card">
    <div class="row"><span class="name">Token</span>${this.badge(sToken, "Configurado", "Sin configurar")}</div>
    <button onclick="send('setSupabaseToken')">${sToken ? "Cambiar token" : "Configurar token"}</button>
    <button class="secondary" onclick="send('initSupabase')" ${!sToken || !cli.supabase ? "disabled" : ""}>supabase init</button>
    <button class="secondary" onclick="send('linkSupabase')" ${!sToken || !cli.supabase ? "disabled" : ""}>Vincular proyecto (link)</button>
    <div class="hint">Token en <a href="https://supabase.com/dashboard/account/tokens">supabase.com/dashboard/account/tokens</a>. Se usa vía <code>SUPABASE_ACCESS_TOKEN</code>.</div>
  </div>

  <h3>EditCore Ops</h3>
  <div class="card">
    <button onclick="send('warRoom')">Sala de guerra (incidente)</button>
    <button class="secondary" onclick="send('deployAutonomous')">Deploy autónomo</button>
    <button class="secondary" onclick="send('openMarketplace')">Marketplace</button>
    <button class="secondary" onclick="send('commandHub')">Command Hub</button>
    <div class="hint">Accesos rápidos al agente y ops de EditCore Claude.</div>
  </div>

<script>
  const vscode = acquireVsCodeApi();
  function send(type) { vscode.postMessage({ type }); }
</script>
</body>
</html>`;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
