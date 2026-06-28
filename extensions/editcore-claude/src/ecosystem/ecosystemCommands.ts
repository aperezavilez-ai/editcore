import * as vscode from "vscode";
import { MarketplaceService } from "../marketplace/marketplaceService";
import { MarketplaceViewProvider } from "../marketplace/marketplaceViewProvider";
import { runAgentBuilderWizard } from "./agentBuilder";
import { loadUnifiedAgentCatalog } from "./agentCatalog";
import { openTemplatePicker } from "./templateLibrary";
import { openIntegrationHub } from "./integrationHub";
import { addTeamMember, loadOrganization, createDefaultOrganization } from "./teamService";
import { TEAM_ROLES, formatPermissionsMarkdown } from "./teamRoles";
import type { TeamRole } from "./types";
import { listHubItems, saveHubItem, searchHubItems } from "./aiHub";
import { addComment, listActivity } from "./collaborationService";
import { createVersionSnapshot, listVersionSnapshots, compareWithSnapshot } from "./versionControl";
import { getPluginSdkDocumentation, listPlugins } from "./pluginSdk";
import { loadUsageMetrics, formatUsageReport, trackUsage } from "./usageAnalytics";
import { formatPlanSummary } from "./commercialPlans";
import { assertOrgPermission } from "./enterpriseSecurity";
import { writeEcosystemDocumentation } from "./docGenerator";
import { writeNextPromptFiles } from "./promptCompletion";
import { AiHubViewProvider } from "./aiHubViewProvider";

export function registerEcosystemCommands(
  context: vscode.ExtensionContext,
  marketplaceService: MarketplaceService,
  marketplaceProvider: MarketplaceViewProvider
): AiHubViewProvider {
  const aiHubProvider = new AiHubViewProvider(context, marketplaceService);
  aiHubProvider.setMarketplaceProvider(marketplaceProvider);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("editcore.aiHubView", aiHubProvider),
    vscode.window.registerWebviewViewProvider("editcore.marketplaceView", marketplaceProvider)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("editcore.ecosystem.openMarketplace", async () => {
      await vscode.commands.executeCommand("editcore.marketplaceView.focus");
      await marketplaceProvider.refresh();
    }),

    vscode.commands.registerCommand("editcore.openMarketplace", async () => {
      await vscode.commands.executeCommand("editcore.ecosystem.openMarketplace");
    }),

    vscode.commands.registerCommand("editcore.ecosystem.openAiHub", async () => {
      await vscode.commands.executeCommand("editcore.aiHubView.focus");
      await aiHubProvider.refresh();
    }),

    vscode.commands.registerCommand("editcore.ecosystem.agentBuilder", async () => {
      if (!(await assertOrgPermission("run_agents", "crear agente"))) return;
      const agent = await runAgentBuilderWizard();
      if (agent) {
        await trackUsage("agentsUsed");
        vscode.window.showInformationMessage('Agente "' + agent.name + '" creado. Usa @custom:' + agent.id);
      }
    }),

    vscode.commands.registerCommand("editcore.ecosystem.listAgents", async () => {
      const catalog = await loadUnifiedAgentCatalog(context.extensionUri);
      const md = "# Catálogo de agentes\n\n" + catalog.map((a) => "- **" + a.name + "** (" + a.source + "): " + a.description).join("\n");
      const doc = await vscode.workspace.openTextDocument({ content: md, language: "markdown" });
      await vscode.window.showTextDocument(doc);
    }),

    vscode.commands.registerCommand("editcore.ecosystem.templates", async () => {
      const id = await openTemplatePicker(context.extensionUri);
      if (id) await vscode.commands.executeCommand("editcore.scaffoldVertical", id);
    }),

    vscode.commands.registerCommand("editcore.ecosystem.integrations", () => openIntegrationHub()),

    vscode.commands.registerCommand("editcore.ecosystem.manageTeam", async () => {
      const org = (await loadOrganization()) ?? (await createDefaultOrganization());
      const action = await vscode.window.showQuickPick(
        [
          { label: "Ver organización", id: "view" },
          { label: "Añadir miembro", id: "add" },
          { label: "Ver permisos por rol", id: "perms" },
        ],
        { placeHolder: org.name + " — " + org.members.length + " miembros" }
      );
      if (!action) return;
      if (action.id === "view") {
        const doc = await vscode.workspace.openTextDocument({ content: JSON.stringify(org, null, 2), language: "json" });
        await vscode.window.showTextDocument(doc);
      } else if (action.id === "add") {
        if (!(await assertOrgPermission("manage_users", "añadir miembro"))) return;
        const email = await vscode.window.showInputBox({ prompt: "Email del miembro" });
        if (!email) return;
        const rolePick = await vscode.window.showQuickPick(
          TEAM_ROLES.map((r) => ({ label: r.label, description: r.description, role: r.id })),
          { placeHolder: "Rol" }
        );
        if (!rolePick) return;
        await addTeamMember(email, rolePick.role as TeamRole);
        vscode.window.showInformationMessage("Miembro añadido.");
      } else if (action.id === "perms") {
        const doc = await vscode.workspace.openTextDocument({ content: formatPermissionsMarkdown(), language: "markdown" });
        await vscode.window.showTextDocument(doc);
      }
    }),

    vscode.commands.registerCommand("editcore.ecosystem.addComment", async () => {
      const target = await vscode.window.showInputBox({ prompt: "Archivo o tarea" });
      const text = await vscode.window.showInputBox({ prompt: "Comentario" });
      if (target && text) await addComment(target, text);
    }),

    vscode.commands.registerCommand("editcore.ecosystem.activity", async () => {
      const activity = await listActivity();
      const md = "# Actividad del equipo\n\n" + activity.map((a) => "- " + a.at + " **" + a.actor + "** " + a.action + ": " + a.detail).join("\n");
      const doc = await vscode.workspace.openTextDocument({ content: md, language: "markdown" });
      await vscode.window.showTextDocument(doc);
    }),

    vscode.commands.registerCommand("editcore.ecosystem.snapshot", async () => {
      const label = await vscode.window.showInputBox({ prompt: "Etiqueta del snapshot" });
      if (!label) return;
      const snap = await createVersionSnapshot(label);
      vscode.window.showInformationMessage("Snapshot " + snap.id + " creado.");
    }),

    vscode.commands.registerCommand("editcore.ecosystem.versions", async () => {
      const snaps = await listVersionSnapshots();
      const pick = await vscode.window.showQuickPick(
        snaps.map((s) => ({ label: s.label, description: s.at, id: s.id })),
        { placeHolder: "Versiones EditCore" }
      );
      if (!pick) return;
      const diff = await compareWithSnapshot(pick.id);
      const doc = await vscode.workspace.openTextDocument({ content: "# Diff\n\n```\n" + diff + "\n```", language: "markdown" });
      await vscode.window.showTextDocument(doc);
    }),

    vscode.commands.registerCommand("editcore.ecosystem.saveToHub", async () => {
      const title = await vscode.window.showInputBox({ prompt: "Título" });
      const content = await vscode.window.showInputBox({ prompt: "Contenido" });
      if (!title || !content) return;
      await saveHubItem({ kind: "prompt", title, content, tags: [], visibility: "private", author: "user" });
      vscode.window.showInformationMessage("Guardado en AI Hub.");
    }),

    vscode.commands.registerCommand("editcore.ecosystem.searchHub", async () => {
      const q = await vscode.window.showInputBox({ prompt: "Buscar en AI Hub" });
      if (!q) return;
      const hits = await searchHubItems(q);
      const md = hits.map((h) => "## " + h.title + "\n" + h.content.slice(0, 300)).join("\n\n");
      const doc = await vscode.workspace.openTextDocument({ content: md || "Sin resultados", language: "markdown" });
      await vscode.window.showTextDocument(doc);
    }),

    vscode.commands.registerCommand("editcore.ecosystem.pluginSdk", async () => {
      const plugins = await listPlugins();
      const md = getPluginSdkDocumentation() + "\n\n## Instalados\n" + plugins.map((p) => "- " + p.name).join("\n");
      const doc = await vscode.workspace.openTextDocument({ content: md, language: "markdown" });
      await vscode.window.showTextDocument(doc);
    }),

    vscode.commands.registerCommand("editcore.ecosystem.analytics", async () => {
      const limits = await formatPlanSummary();
      const report = formatUsageReport(await loadUsageMetrics());
      const doc = await vscode.workspace.openTextDocument({ content: limits + "\n\n" + report, language: "markdown" });
      await vscode.window.showTextDocument(doc);
    }),

    vscode.commands.registerCommand("editcore.ecosystem.generateDocs", async () => {
      const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!root) return;
      const paths = await writeEcosystemDocumentation(root);
      await writeNextPromptFiles(root);
      vscode.window.showInformationMessage("Docs ecosistema + SIGUIENTE_PROMPT_007: " + paths.length + " archivos");
    }),

    vscode.commands.registerCommand("editcore.ecosystem.openNextPrompt", async () => {
      const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!root) return;
      const uri = vscode.Uri.file(root + "/.editcore/docs/SIGUIENTE_PROMPT_007.md");
      try {
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc);
      } catch {
        await writeNextPromptFiles(root);
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc);
      }
    })
  );

  return aiHubProvider;
}
