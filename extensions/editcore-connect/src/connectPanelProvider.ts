import * as vscode from "vscode";
import { getGithubSessionLabel } from "./githubAuth";
import type { VercelProjectState } from "./vercelService";
import type { GlobalConnectStatus } from "./globalConnect";

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
}

export class ConnectPanelProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private cliStatus: CliStatus = { vercel: false, supabase: false, git: false, gh: false };
  private vercelState: VercelProjectState = { linked: false };
  private globalStatus: GlobalConnectStatus = {
    vercelAccountOk: false,
    supabaseAccountOk: false,
    workspaceLinkedVercel: false,
    workspaceLinkedSupabase: false,
  };

  constructor(private readonly context: vscode.ExtensionContext) {}

  setVercelState(state: VercelProjectState) {
    this.vercelState = state;
    this.render();
  }

  setGlobalStatus(status: GlobalConnectStatus) {
    this.globalStatus = status;
    this.render();
  }

  refreshVercel() {
    void vscode.commands.executeCommand("editcoreConnect.refreshVercelStatus");
  }

  setGithubRepoInfo(_info?: string) {}
  setGithubLists(_issues: string, _prs: string) {}

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    this.render();

    webviewView.webview.onDidReceiveMessage((msg) => {
      switch (msg.type) {
        case "connectGithub":
          void vscode.commands.executeCommand("editcoreConnect.signInGithub");
          break;
        case "signInVercel":
          void vscode.commands.executeCommand("editcoreConnect.signInVercel");
          break;
        case "signInSupabase":
          void vscode.commands.executeCommand("editcoreConnect.signInSupabase");
          break;
        case "changeVercelToken":
          void vscode.commands.executeCommand("editcoreConnect.setVercelToken");
          break;
        case "changeSupabaseToken":
          void vscode.commands.executeCommand("editcoreConnect.setSupabaseToken");
          break;
        case "disconnectVercel":
          void vscode.commands.executeCommand("editcoreConnect.clearVercelToken");
          break;
        case "disconnectSupabase":
          void vscode.commands.executeCommand("editcoreConnect.clearSupabaseToken");
          break;
        case "pickVercelProject":
          void vscode.commands.executeCommand("editcoreConnect.pickVercelProject");
          break;
        case "pickSupabaseProject":
          void vscode.commands.executeCommand("editcoreConnect.pickSupabaseProject");
          break;
        case "syncWorkspace":
          void vscode.commands.executeCommand("editcoreConnect.syncWorkspace");
          break;
        case "deployVercel":
          void vscode.commands.executeCommand("editcoreConnect.deployVercel");
          break;
        case "openVercelPreview":
          void vscode.commands.executeCommand("editcoreConnect.openVercelPreview");
          break;
        case "showDomainGuide":
          void vscode.commands.executeCommand("editcoreConnect.showDomainGuide");
          break;
        case "recheckCli":
          void vscode.commands.executeCommand("editcoreConnect.checkCli");
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
    this.view.webview.html = this.getHtml(hasVercel, hasSupabase, githubAccount);
  }

  private badge(ok: boolean, labelOk: string, labelBad: string): string {
    return ok
      ? `<span class="badge ok">${labelOk}</span>`
      : `<span class="badge bad">${labelBad}</span>`;
  }

  private cliChip(name: string, ok: boolean): string {
    return `<span class="chip ${ok ? "ok" : "bad"}">${name}</span>`;
  }

  private getHtml(vToken: boolean, sToken: boolean, githubAccount?: string): string {
    const cli = this.cliStatus;
    const g = this.globalStatus;
    const githubSignedIn = Boolean(githubAccount);
    const vercelGlobal = vToken && g.vercelAccountOk;
    const supabaseGlobal = sToken && g.supabaseAccountOk;
    const vercelProject =
      g.vercelProjectName ?? this.vercelState.projectName ?? (g.workspaceLinkedVercel ? "Vinculado" : undefined);
    const vercelReady = vercelGlobal && (g.workspaceLinkedVercel || this.vercelState.linked);

    return /* html */ `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground);
    background: var(--vscode-sideBar-background); margin:0; padding:14px; font-size:13px; }
  h3 { font-size:12px; text-transform:uppercase; letter-spacing:0.5px; opacity:0.65; margin:16px 0 8px; }
  h3:first-child { margin-top:0; }
  .card { background: var(--vscode-editor-inactiveSelectionBackground); border-radius:8px;
    padding:12px; margin-bottom:10px; }
  .row { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; gap:8px; }
  .row:last-child { margin-bottom:0; }
  .name { font-weight:600; }
  .badge { font-size:11px; padding:2px 8px; border-radius:10px; white-space:nowrap; }
  .badge.ok { background: rgba(50,180,90,0.18); color:#3fb950; }
  .badge.bad { background: rgba(220,80,80,0.18); color:#e5534b; }
  .chips { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:8px; }
  .chip { font-size:10px; padding:2px 7px; border-radius:8px; }
  .chip.ok { background: rgba(50,180,90,0.15); color:#3fb950; }
  .chip.bad { background: rgba(220,80,80,0.15); color:#e5534b; }
  button { font-size:12px; background: var(--vscode-button-background); color: var(--vscode-button-foreground);
    border:none; border-radius:4px; padding:8px 10px; cursor:pointer; width:100%; margin-top:6px; }
  button:hover { background: var(--vscode-button-hoverBackground); }
  button.secondary { background:none; border:1px solid var(--vscode-button-border, var(--vscode-panel-border));
    color: var(--vscode-foreground); padding:6px 10px; }
  button.danger { background:none; border:1px solid rgba(220,80,80,0.5); color:#e5534b; padding:6px 10px; }
  button:disabled { opacity:0.45; cursor:not-allowed; }
  .actions-row { display:flex; gap:6px; margin-top:6px; flex-wrap:wrap; }
  .actions-row button { margin-top:0; flex:1; min-width:45%; }
  .hint { font-size:11px; opacity:0.6; margin-top:8px; line-height:1.5; }
  .account { font-size:11px; opacity:0.85; text-align:right; overflow:hidden; text-overflow:ellipsis; max-width:58%; }
  .global-ok { font-size:12px; color:#3fb950; margin-bottom:6px; }
</style>
</head>
<body>

  <h3>Tu cuenta EditCore</h3>
  <div class="card">
    <div class="hint" style="margin-top:0;margin-bottom:10px;">Conectá una vez. Cada proyecto se vincula solo al abrir la carpeta (como Cursor).</div>
    <div class="row">
      <span class="name">Vercel</span>
      ${vercelGlobal ? this.badge(true, "Cuenta conectada", "") : vToken ? this.badge(false, "", "Token inválido") : this.badge(false, "", "Sin conectar")}
    </div>
    ${
      vercelGlobal
        ? `<div class="actions-row">
            <button class="secondary" onclick="send('changeVercelToken')">Cambiar token</button>
            <button class="danger" onclick="send('disconnectVercel')">Desconectar</button>
          </div>`
        : `<button onclick="send('signInVercel')">Conectar cuenta Vercel</button>`
    }
    <div class="row" style="margin-top:10px">
      <span class="name">Supabase</span>
      ${supabaseGlobal ? this.badge(true, "Cuenta conectada", "") : sToken ? this.badge(false, "", "Token inválido") : this.badge(false, "", "Sin conectar")}
    </div>
    ${
      supabaseGlobal
        ? `<div class="actions-row">
            <button class="secondary" onclick="send('changeSupabaseToken')">Cambiar token</button>
            <button class="danger" onclick="send('disconnectSupabase')">Desconectar</button>
          </div>`
        : `<button onclick="send('signInSupabase')">Conectar cuenta Supabase</button>`
    }
  </div>

  <h3>Este proyecto</h3>
  <div class="card">
    <div class="row">
      <span class="name">Vercel</span>
      ${vercelReady ? this.badge(true, vercelProject ?? "Listo", "") : vercelGlobal ? this.badge(false, "", "Sin vincular") : this.badge(false, "", "—")}
    </div>
    <div class="row">
      <span class="name">Supabase</span>
      ${g.workspaceLinkedSupabase ? this.badge(true, g.supabaseProjectName ?? "Listo", "") : supabaseGlobal ? this.badge(false, "", "Sin vincular") : this.badge(false, "", "—")}
    </div>
    ${this.vercelState.lastDeployUrl ? `<div class="hint">Último deploy: <code>${escapeHtml(this.vercelState.lastDeployUrl)}</code></div>` : ""}
    ${
      vercelGlobal
        ? `<div class="actions-row">
            <button class="secondary" onclick="send('pickVercelProject')">Elegir proyecto Vercel</button>
            <button class="secondary" onclick="send('pickSupabaseProject')" ${!supabaseGlobal ? "disabled" : ""}>Elegir Supabase</button>
          </div>
          <div class="actions-row">
            <button class="secondary" onclick="send('syncWorkspace')">Sincronizar ahora</button>
            <button class="secondary" onclick="send('deployVercel')" ${!vercelReady ? "disabled" : ""}>Deploy</button>
            <button class="secondary" onclick="send('openVercelPreview')" ${!this.vercelState.lastDeployUrl ? "disabled" : ""}>Abrir sitio</button>
          </div>`
        : `<div class="hint">Conectá Vercel arriba para deploy automático en este proyecto.</div>`
    }
    <div class="hint">Dominio propio: <a href="#" onclick="send('showDomainGuide');return false;">guía DNS</a></div>
  </div>

  <h3>GitHub</h3>
  <div class="card">
    <div class="row">
      <span class="name">Cuenta</span>
      ${githubSignedIn ? `<span class="account">${escapeHtml(githubAccount!)}</span>` : this.badge(false, "", "Sin sesión")}
    </div>
    <button onclick="send('connectGithub')">${githubSignedIn ? "Renovar sesión" : "Conectar GitHub"}</button>
  </div>

  <h3>Herramientas</h3>
  <div class="card">
    <div class="chips">
      ${this.cliChip("Git", cli.git)}
      ${this.cliChip("gh", cli.gh)}
      ${this.cliChip("Vercel CLI", cli.vercel)}
      ${this.cliChip("Supabase CLI", cli.supabase)}
    </div>
    <button class="secondary" onclick="send('recheckCli')">Verificar</button>
    <div class="hint">Deploy usa API cuando puede; las CLIs son opcionales para comandos avanzados.</div>
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
