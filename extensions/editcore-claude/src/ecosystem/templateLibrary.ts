/**
 * Biblioteca de plantillas — Fase 5 (Prompt 6).
 */
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { MarketplaceService } from "../marketplace/marketplaceService";

export interface TemplateEntry {
  id: string;
  name: string;
  category: string;
  description: string;
  tier?: string;
  installed: boolean;
}

const TEMPLATE_CATEGORIES = [
  { id: "saas", label: "SaaS" },
  { id: "marketplace", label: "Marketplace" },
  { id: "crm", label: "CRM" },
  { id: "erp", label: "ERP" },
  { id: "mobile", label: "Apps móviles" },
  { id: "api", label: "APIs" },
  { id: "landing", label: "Landing pages" },
  { id: "gps", label: "GPS / Flotas" },
];

export async function listTemplateLibrary(extensionUri: vscode.Uri): Promise<TemplateEntry[]> {
  const service = new MarketplaceService(extensionUri);
  const catalog = await service.getCatalog();
  const installed = await service.getInstalledIds();

  const fromCatalog = catalog.items
    .filter((i) => i.type === "template")
    .map((i) => ({
      id: i.id,
      name: i.name,
      category: i.vertical ?? "general",
      description: i.description,
      tier: i.tier,
      installed: installed.has(i.id),
    }));

  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const local: TemplateEntry[] = [];
  if (root) {
    const tplDir = path.join(root, ".editcore", "templates");
    if (fs.existsSync(tplDir)) {
      for (const name of fs.readdirSync(tplDir)) {
        if (!fromCatalog.some((t) => t.id === name)) {
          local.push({
            id: name,
            name,
            category: "local",
            description: "Plantilla instalada localmente",
            installed: true,
          });
        }
      }
    }
  }

  return [...fromCatalog, ...local];
}

export function getTemplateCategories(): typeof TEMPLATE_CATEGORIES {
  return TEMPLATE_CATEGORIES;
}

export async function openTemplatePicker(extensionUri: vscode.Uri): Promise<string | undefined> {
  const templates = await listTemplateLibrary(extensionUri);
  const pick = await vscode.window.showQuickPick(
    templates.map((t) => ({
      label: t.name,
      description: t.category + (t.installed ? " · instalada" : ""),
      id: t.id,
    })),
    { placeHolder: "EDITCORE Template Library" }
  );
  return pick?.id;
}
