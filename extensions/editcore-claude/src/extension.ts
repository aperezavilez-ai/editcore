import * as vscode from "vscode";
import { ClaudeChatViewProvider } from "./chatViewProvider";
import { ClaudeConfigViewProvider } from "./configViewProvider";
import { EditCoreHomeViewProvider } from "./homeViewProvider";
import { callWithFallback } from "./aiRouter";
import { AgentPanel } from "./agent/agentPanel";
import { registerClaudeChatParticipant } from "./chatParticipant";
import { registerClaudeLanguageModelProvider } from "./languageModelProvider";
import { ApiKeyService } from "./apiKeyService";
import { LLM_VENDOR } from "./llmConfig";
import { getWorkspaceIndex } from "./index/workspaceIndex";
import { getRagIndex } from "./rag/chunkIndex";
import { buildDependencyGraph } from "./twin/dependencyGraph";
import { McpManager } from "./mcp/mcpClient";
import { runAutonomousDeploy } from "./ops/warRoom";
import { MarketplaceService } from "./marketplace/marketplaceService";
import { MarketplaceViewProvider } from "./marketplace/marketplaceViewProvider";
import {
  founderMode,
  ctoMode,
  saasBuilder,
  gpsBuilder,
  scaffoldVertical,
  showAuditLog,
} from "./verticals/verticalCommands";
import { showSessionsPicker, exportSessionsReport, resumeSession } from "./sessions/agentSessionStore";
import { initOrgConfig } from "./enterprise/orgConfig";
import { showInitWorkspaceResult } from "./workspace/workspaceBootstrap";
import { showCommandHub } from "./hub/commandHub";
import { createStatusBarItem, showAbout } from "./hub/statusBar";
import { initVoyageService } from "./rag/voyageService";
import { registerDiagnosticCommands } from "./diagnostics/diagnosticCommands";
import { registerQuickActionsBar } from "./hub/quickActionsBar";
import { registerWelcomePanel, showWelcomeIfNeeded } from "./welcome/welcomePanel";
import { setDiagnosticRuntime } from "./diagnostics/diagnosticRuntime";

export function activate(context: vscode.ExtensionContext) {
  void writeActivationProbe(context);
  registerQuickActionsBar(context);
  registerWelcomePanel(context);
  void showWelcomeIfNeeded(context);

  const apiKeyService = new ApiKeyService(context);
  setDiagnosticRuntime(context, apiKeyService);
  initVoyageService(context);

  registerClaudeLanguageModelProvider(context, apiKeyService);
  registerClaudeChatParticipant(context, apiKeyService);

  // Precalentar índice del workspace para búsqueda semántica ligera.
  if (vscode.workspace.workspaceFolders?.length) {
    void getWorkspaceIndex().ensureIndexed();
    void getRagIndex().ensureBuilt();
    context.subscriptions.push(
      vscode.workspace.onDidSaveTextDocument((doc) => {
        void getWorkspaceIndex().ensureIndexed();
        if (doc.uri.scheme === 'file') {
          void getWorkspaceIndex().updateFile(doc.uri.fsPath);
          void getRagIndex().updateFile(doc.uri.fsPath);
        }
      })
    );
    void maybePromptWorkspaceInit(context);
  }

  context.subscriptions.push(
    vscode.commands.registerCommand("editcore.reindexWorkspace", async () => {
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: "Indexando workspace..." },
        async () => {
          const index = getWorkspaceIndex();
          const rag = getRagIndex();
          await index.forceRebuild();
          await rag.forceRebuild();
        }
      );
      vscode.window.showInformationMessage("EditCore: índice keyword + RAG actualizado.");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("editcore.diagnoseNativeModels", async () => {
      const models = await vscode.lm.selectChatModels({ vendor: LLM_VENDOR });
      const lines = models.map((model) => `${model.id} | ${model.vendor} | ${model.family} | ${model.name}`);
      const message = lines.length
        ? `EditCore modelos nativos: ${lines.length}\n${lines.join("\n")}`
        : "EditCore no devolvio modelos nativos. El proveedor no se activo o fue bloqueado por el host.";
      await vscode.window.showInformationMessage(message, { modal: true });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("editcore.buildRagIndex", async () => {
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: "Construyendo índice RAG..." },
        async () => {
          await getRagIndex().forceRebuild();
        }
      );
      const stats = getRagIndex().getStats();
      vscode.window.showInformationMessage(
        `EditCore RAG: ${stats.chunks} chunks en ${stats.files} archivos.`
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("editcore.refreshMcp", async () => {
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: "Conectando servidores MCP..." },
        () => McpManager.getInstance().refresh()
      );
      vscode.window.showInformationMessage("EditCore: servidores MCP actualizados.");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("editcore.updateDigitalTwin", async () => {
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: "Generando gemelo digital..." },
        () => buildDependencyGraph()
      );
      vscode.window.showInformationMessage("EditCore: grafo guardado en .editcore/graph.json");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("editcore.warRoom", async () => {
      const desc = await vscode.window.showInputBox({
        prompt: "Describe el error o incidente de producción",
        placeHolder: "ej: 500 en /api/users tras el último deploy",
      });
      if (!desc?.trim()) {
        return;
      }
      const hasKey = await apiKeyService.hasAnyLlmKey();
      if (!hasKey) {
        await vscode.commands.executeCommand("editcore.openAccountPanel");
        return;
      }
      await vscode.commands.executeCommand("workbench.action.chat.open", {
        query: `@claude Analiza este incidente (sala de guerra): ${desc}`,
      });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("editcore.deployAutonomous", () => runAutonomousDeploy())
  );

  const marketplaceService = new MarketplaceService(context.extensionUri);
  const marketplaceProvider = new MarketplaceViewProvider(context, marketplaceService);

  context.subscriptions.push(
    vscode.commands.registerCommand("editcore.openMarketplace", async () => {
      await vscode.commands.executeCommand("workbench.view.extension.editcore-sidebar");
      await vscode.commands.executeCommand("editcore.marketplaceView.focus");
    }),
    vscode.commands.registerCommand("editcore.founderMode", () => founderMode()),
    vscode.commands.registerCommand("editcore.ctoMode", () => ctoMode()),
    vscode.commands.registerCommand("editcore.saasBuilder", () => saasBuilder()),
    vscode.commands.registerCommand("editcore.gpsBuilder", () => gpsBuilder()),
    vscode.commands.registerCommand("editcore.scaffoldVertical", (templateId?: string) => {
      if (!templateId) {
        return vscode.window.showWarningMessage("Seleccioná una plantilla desde el Marketplace.");
      }
      return scaffoldVertical(templateId);
    }),
    vscode.commands.registerCommand("editcore.showAuditLog", () => showAuditLog()),
    vscode.commands.registerCommand("editcore.showSessions", () => showSessionsPicker()),
    vscode.commands.registerCommand("editcore.initOrg", () => initOrgConfig()),
    vscode.commands.registerCommand("editcore.initWorkspace", () => showInitWorkspaceResult()),
    vscode.commands.registerCommand("editcore.exportSessions", () => exportSessionsReport()),
    vscode.commands.registerCommand("editcore.refreshMarketplace", () => marketplaceProvider.refresh()),
    vscode.commands.registerCommand("editcore.commandHub", () => showCommandHub()),
    vscode.commands.registerCommand("editcore.resumeSession", () => resumeSession()),
    vscode.commands.registerCommand("editcore.about", () => showAbout())
  );

  createStatusBarItem(context);
  registerDiagnosticCommands(context, apiKeyService);

  const chatProvider = new ClaudeChatViewProvider(context, apiKeyService);
  const configProvider = new ClaudeConfigViewProvider(context, apiKeyService);
  const homeProvider = new EditCoreHomeViewProvider(apiKeyService);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("editcore.homeView", homeProvider),
    vscode.window.registerWebviewViewProvider("editcore.chatView", chatProvider),
    vscode.window.registerWebviewViewProvider("editcore.accountView", configProvider),
    vscode.window.registerWebviewViewProvider("editcore.marketplaceView", marketplaceProvider)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("editcore.setApiKey", async () => {
      await vscode.commands.executeCommand("editcore.openAccountPanel");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("editcore.openAccountPanel", async () => {
      try {
        await vscode.commands.executeCommand("workbench.view.extension.editcore-sidebar");
      } catch {
        // continuar
      }
      await vscode.commands.executeCommand("editcore.accountView.focus");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("editcore.openChat", async () => {
      await vscode.commands.executeCommand("workbench.action.chat.open", {
        query: "@claude ",
      });
    })
  );

  // Prefijar @claude en chats nuevos (estilo Cursor).
  context.subscriptions.push(
    vscode.commands.registerCommand("editcore.focusChatInput", async () => {
      await vscode.commands.executeCommand("workbench.action.chat.open", {
        query: "@claude ",
      });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("editcore.openAgent", () => {
      AgentPanel.show(context, apiKeyService);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("editcore.explainSelection", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      const selection = editor.document.getText(editor.selection);
      if (!selection.trim()) {
        vscode.window.showWarningMessage("Selecciona código primero.");
        return;
      }
      await runWithProgress(apiKeyService, "Explicando selección...", async () => {
        const { text, usage } = await callWithFallback(apiKeyService, [
          {
            role: "user",
            content: `Explica este código de forma clara y concisa:\n\n\`\`\`\n${selection}\n\`\`\``,
          },
        ]);
        apiKeyService.recordUsage(usage.inputTokens, usage.outputTokens);
        chatProvider.postAssistantMessage(text);
        chatProvider.reveal();
      });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("editcore.fixSelection", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      const selection = editor.selection;
      const code = editor.document.getText(selection);
      if (!code.trim()) {
        vscode.window.showWarningMessage("Selecciona código primero.");
        return;
      }
      await runWithProgress(apiKeyService, "Corrigiendo código...", async () => {
        const { text, usage } = await callWithFallback(apiKeyService, [
          {
            role: "user",
            content: `Corrige errores en este código. Responde ÚNICAMENTE con el código corregido, sin explicaciones ni markdown:\n\n${code}`,
          },
        ]);
        apiKeyService.recordUsage(usage.inputTokens, usage.outputTokens);
        const cleaned = stripCodeFences(text);
        await editor.edit((editBuilder) => {
          editBuilder.replace(selection, cleaned);
        });
        vscode.window.showInformationMessage("EditCore: código corregido.");
      });
    })
  );
}

async function writeActivationProbe(context: vscode.ExtensionContext): Promise<void> {
  try {
    const fs = await import("fs");
    const path = await import("path");
    const probePath = path.join(context.globalStorageUri.fsPath, "native-model-provider-probe.json");
    await fs.promises.mkdir(path.dirname(probePath), { recursive: true });
    await fs.promises.writeFile(
      probePath,
      JSON.stringify({
        activatedAt: new Date().toISOString(),
        extensionPath: context.extensionPath,
        vendor: LLM_VENDOR,
      }, null, 2)
    );
  } catch {
    // Best-effort diagnostic marker only.
  }
}

async function runWithProgress(
  apiKeyService: ApiKeyService,
  title: string,
  task: () => Promise<void>
): Promise<void> {
  const hasKey = await apiKeyService.hasAnyLlmKey();
  if (!hasKey) {
    const choice = await vscode.window.showWarningMessage(
      "No has configurado ninguna API Key (Anthropic u OpenAI).",
      "Abrir Cuenta & API"
    );
    if (choice === "Abrir Cuenta & API") {
      await vscode.commands.executeCommand("editcore.openAccountPanel");
    }
    return;
  }
  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title },
    async () => {
      try {
        await task();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`EditCore: ${message}`);
      }
    }
  );
}

function stripCodeFences(text: string): string {
  const match = text.match(/```[a-zA-Z]*\n([\s\S]*?)```/);
  return match ? match[1].trim() : text.trim();
}

async function maybePromptWorkspaceInit(context: vscode.ExtensionContext): Promise<void> {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) return;
  const flagKey = `editcore.initPrompt.${root}`;
  if (context.globalState.get(flagKey)) return;

  const fs = await import("fs");
  const path = await import("path");
  const rulesPath = path.join(root, ".editcore", "rules.md");
  if (fs.existsSync(rulesPath)) {
    await context.globalState.update(flagKey, true);
    return;
  }

  const choice = await vscode.window.showInformationMessage(
    "EditCore: ¿inicializar carpeta .editcore/ para este proyecto?",
    "Inicializar",
    "Después"
  );
  await context.globalState.update(flagKey, true);
  if (choice === "Inicializar") {
    await vscode.commands.executeCommand("editcore.initWorkspace");
  }
}

export function deactivate() {}
