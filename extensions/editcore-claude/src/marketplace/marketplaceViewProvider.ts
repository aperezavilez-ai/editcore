import * as vscode from 'vscode';
import { MarketplaceItem, MarketplaceService } from './marketplaceService';
import { getEffectivePlan } from '../enterprise/orgConfig';

export class MarketplaceViewProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly service: MarketplaceService
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    void this.refresh();

    webviewView.webview.onDidReceiveMessage(async (msg) => {
      try {
        if (msg.type === 'install' && msg.id) {
          const catalog = await this.service.getCatalog();
          const item = catalog.items.find((i) => i.id === msg.id);
          if (!item) return;
          await this.service.install(item);
          vscode.window.showInformationMessage(`EditCore Marketplace: "${item.name}" instalado.`);
          await this.refresh();
        } else if (msg.type === 'uninstall' && msg.id) {
          await this.service.uninstall(msg.id);
          vscode.window.showInformationMessage('Ítem desinstalado del workspace.');
          await this.refresh();
        } else if (msg.type === 'useAgent' && msg.id) {
          const catalog = await this.service.getCatalog();
          const item = catalog.items.find((i) => i.id === msg.id);
          if (item?.role) {
            await vscode.commands.executeCommand('workbench.action.chat.open', {
              query: `@claude @${item.role} `,
            });
          }
        } else if (msg.type === 'scaffold' && msg.id) {
          await vscode.commands.executeCommand('editcore.scaffoldVertical', msg.id);
        } else if (msg.type === 'refresh') {
          await this.refresh();
        }
      } catch (err: unknown) {
        const text = err instanceof Error ? err.message : String(err);
        this.view?.webview.postMessage({ type: 'error', text });
      }
    });
  }

  async refresh(): Promise<void> {
    if (!this.view) return;
    const catalog = await this.service.getCatalog();
    const installed = await this.service.getInstalledIds();
    const plan = await getEffectivePlan();
    const remoteUrl = vscode.workspace
      .getConfiguration('editcore')
      .get<string>('marketplace.remoteUrl', '')
      .trim();
    this.view.webview.html = this.renderHtml(catalog.items, installed, plan, remoteUrl);
  }

  private renderHtml(
    items: MarketplaceItem[],
    installed: Set<string>,
    plan: string,
    remoteUrl: string
  ): string {
    const cards = items
      .map((item) => {
        const isInstalled = installed.has(item.id);
        const tierBadge = `<span class="tier tier-${item.tier}">${item.tier}</span>`;
        const typeBadge = `<span class="type">${item.type}</span>`;
        const actions =
          item.type === 'template'
            ? `<button onclick="scaffold('${item.id}')" ${!isInstalled ? 'disabled' : ''}>Abrir plantilla</button>`
            : item.type === 'agent'
              ? `<button class="secondary" onclick="useAgent('${item.id}')" ${!isInstalled ? 'disabled' : ''}>Usar en chat</button>`
              : '';
        return `<div class="card">
          <div class="row"><strong>${esc(item.name)}</strong>${tierBadge}${typeBadge}</div>
          <p>${esc(item.description)}</p>
          <p class="meta">por ${esc(item.author)}</p>
          ${
            isInstalled
              ? `<button class="secondary" onclick="uninstall('${item.id}')">Desinstalar</button>${actions}`
              : `<button onclick="install('${item.id}')">Instalar</button>`
          }
        </div>`;
      })
      .join('');

    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
      body{font-family:var(--vscode-font-family);font-size:13px;padding:12px;color:var(--vscode-foreground);background:var(--vscode-sideBar-background)}
      h2{font-size:14px;margin:0 0 8px}
      .sub{opacity:.7;font-size:12px;margin-bottom:12px}
      .card{border:1px solid var(--vscode-panel-border,rgba(128,128,128,.3));border-radius:8px;padding:10px;margin-bottom:10px;background:var(--vscode-editor-background)}
      .row{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
      .meta{font-size:11px;opacity:.65;margin:4px 0}
      .tier{font-size:10px;padding:2px 6px;border-radius:8px;text-transform:uppercase}
      .tier-free{background:rgba(46,160,67,.2);color:#3fb950}
      .tier-pro{background:rgba(56,139,253,.2);color:#58a6ff}
      .tier-business{background:rgba(210,153,34,.2);color:#d29922}
      .type{font-size:10px;opacity:.6}
      button{width:100%;margin-top:6px;padding:6px;border:none;border-radius:4px;cursor:pointer;background:var(--vscode-button-background);color:var(--vscode-button-foreground)}
      button.secondary{background:transparent;border:1px solid var(--vscode-panel-border);color:var(--vscode-foreground)}
      button:disabled{opacity:.45;cursor:not-allowed}
      #err{color:var(--vscode-errorForeground);font-size:12px;margin-top:8px}
    </style></head><body>
      <h2>EditCore Marketplace</h2>
      <p class="sub">Plan: <strong>${esc(plan)}</strong>${remoteUrl ? ' · catálogo remoto activo' : ''} · <code>.editcore/</code></p>
      <button class="secondary" onclick="refresh()">Actualizar catálogo</button>
      ${cards || '<p>No hay ítems en el catálogo.</p>'}
      <div id="err"></div>
      <script>
        const vscode = acquireVsCodeApi();
        function install(id){ vscode.postMessage({type:'install',id}); }
        function uninstall(id){ vscode.postMessage({type:'uninstall',id}); }
        function useAgent(id){ vscode.postMessage({type:'useAgent',id}); }
        function scaffold(id){ vscode.postMessage({type:'scaffold',id}); }
        function refresh(){ vscode.postMessage({type:'refresh'}); }
        window.addEventListener('message',e=>{ if(e.data?.type==='error') document.getElementById('err').textContent=e.data.text; });
      </script>
    </body></html>`;
  }
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
