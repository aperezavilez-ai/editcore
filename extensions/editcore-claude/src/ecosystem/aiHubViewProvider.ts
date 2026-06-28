/**
 * AI Hub + Marketplace panel — Fases 10/12 (Prompt 6).
 */
import * as vscode from "vscode";
import { MarketplaceService } from "../marketplace/marketplaceService";
import { MarketplaceViewProvider } from "../marketplace/marketplaceViewProvider";
import { listHubItems } from "./aiHub";
import { loadOrganization } from "./teamService";
import { loadUsageMetrics, formatUsageReport } from "./usageAnalytics";
import { formatPlanSummary } from "./commercialPlans";

export class AiHubViewProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private marketplaceProvider?: MarketplaceViewProvider;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly marketplaceService: MarketplaceService
  ) {}

  setMarketplaceProvider(provider: MarketplaceViewProvider): void {
    this.marketplaceProvider = provider;
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.onDidReceiveMessage(async (msg) => {
      if (msg.type === "refresh") await this.refresh();
      if (msg.type === "openMarketplace") await vscode.commands.executeCommand("editcore.ecosystem.openMarketplace");
      if (msg.type === "agentBuilder") await vscode.commands.executeCommand("editcore.ecosystem.agentBuilder");
      if (msg.type === "templates") await vscode.commands.executeCommand("editcore.ecosystem.templates");
      if (msg.type === "integrations") await vscode.commands.executeCommand("editcore.ecosystem.integrations");
      if (msg.type === "team") await vscode.commands.executeCommand("editcore.ecosystem.manageTeam");
      if (msg.type === "analytics") await vscode.commands.executeCommand("editcore.ecosystem.analytics");
    });
    void this.refresh();
  }

  async refresh(): Promise<void> {
    if (!this.view) return;
    const [org, hub, metrics, planSummary] = await Promise.all([
      loadOrganization(),
      listHubItems(),
      loadUsageMetrics(),
      formatPlanSummary(),
    ]);
    this.view.webview.html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
      body{font-family:var(--vscode-font-family);font-size:12px;padding:10px;color:var(--vscode-foreground);background:var(--vscode-sideBar-background)}
      h2{font-size:13px;margin:0 0 6px} .stat{padding:8px;border-radius:6px;background:var(--vscode-editor-background);border:1px solid var(--vscode-panel-border);margin-bottom:8px;font-size:11px}
      button{width:100%;margin:4px 0;padding:8px;border:none;border-radius:6px;cursor:pointer;background:var(--vscode-button-background);color:var(--vscode-button-foreground);font:inherit}
      button.sec{background:transparent;border:1px solid var(--vscode-panel-border);color:var(--vscode-foreground)}
    </style></head><body>
      <h2>EDITCORE AI Hub</h2>
      <div class="stat"><b>${org?.name ?? "Sin org"}</b><br/>${planSummary.replace(/\n/g, "<br/>")}</div>
      <div class="stat">Hub: ${hub.length} ítems · Agentes usados: ${metrics.agentsUsed} · Tareas: ${metrics.tasksCompleted}</div>
      <button onclick="vscode.postMessage({type:'openMarketplace'})">Marketplace de agentes</button>
      <button onclick="vscode.postMessage({type:'agentBuilder'})">Agent Builder</button>
      <button onclick="vscode.postMessage({type:'templates'})">Template Library</button>
      <button onclick="vscode.postMessage({type:'integrations'})">Integraciones</button>
      <button class="sec" onclick="vscode.postMessage({type:'team'})">Equipo y roles</button>
      <button class="sec" onclick="vscode.postMessage({type:'analytics'})">Analítica</button>
      <button class="sec" onclick="vscode.postMessage({type:'refresh'})">Actualizar</button>
      <script>const vscode=acquireVsCodeApi();</script>
    </body></html>`;
    await this.marketplaceProvider?.refresh();
  }
}
