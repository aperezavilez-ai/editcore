/**
 * Integraciones externas — Fase 7 (Prompt 6).
 */
import * as vscode from "vscode";

export interface IntegrationConnector {
  id: string;
  name: string;
  category: string;
  command?: string;
  extensionId?: string;
  description: string;
}

export const INTEGRATION_CONNECTORS: IntegrationConnector[] = [
  { id: "github", name: "GitHub", category: "git", extensionId: "editcore.editcore-connect", description: "Repos, PRs, Actions" },
  { id: "gitlab", name: "GitLab", category: "git", description: "Repos y CI (vía git remoto)" },
  { id: "bitbucket", name: "Bitbucket", category: "git", description: "Repos Atlassian" },
  { id: "vercel", name: "Vercel", category: "deploy", extensionId: "editcore.editcore-connect", command: "workbench.view.extension.editcore-connect-sidebar", description: "Deploy frontend" },
  { id: "supabase", name: "Supabase", category: "database", extensionId: "editcore.editcore-connect", description: "Auth, DB, Storage" },
  { id: "postgres", name: "PostgreSQL", category: "database", description: "Base de datos relacional" },
  { id: "aws", name: "AWS", category: "cloud", description: "Cloud provider" },
  { id: "gcp", name: "Google Cloud", category: "cloud", description: "Cloud provider" },
  { id: "azure", name: "Azure", category: "cloud", description: "Cloud provider" },
  { id: "slack", name: "Slack", category: "enterprise", description: "Notificaciones equipo" },
  { id: "jira", name: "Jira", category: "enterprise", description: "Gestión de proyectos" },
];

export async function openIntegrationHub(): Promise<void> {
  const pick = await vscode.window.showQuickPick(
    INTEGRATION_CONNECTORS.map((c) => ({
      label: c.name,
      description: c.category + " — " + c.description,
      connector: c,
    })),
    { placeHolder: "Integraciones EditCore" }
  );
  if (!pick) return;

  if (pick.connector.command) {
    await vscode.commands.executeCommand(pick.connector.command);
    return;
  }
  if (pick.connector.extensionId) {
    const ext = vscode.extensions.getExtension(pick.connector.extensionId);
    if (ext) {
      await vscode.commands.executeCommand("workbench.view.extension.editcore-connect-sidebar");
    } else {
      vscode.window.showInformationMessage(
        "Instala la extensión " + pick.connector.extensionId + " para conectar " + pick.connector.name
      );
    }
    return;
  }
  vscode.window.showInformationMessage(
    pick.connector.name + ": configura el remoto git o variables en .editcore/"
  );
}
