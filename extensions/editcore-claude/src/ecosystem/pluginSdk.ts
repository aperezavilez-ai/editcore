/**
 * Plugin SDK — Fase 6 (Prompt 6).
 */
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import type { PluginManifest } from "./types";

const PLUGINS_DIR = path.join(".editcore", "plugins");

function workspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

export const PLUGIN_SDK_VERSION = "1.0.0";

export const DEFAULT_PLUGIN_MANIFEST: PluginManifest = {
  id: "my-plugin",
  name: "Mi Plugin",
  version: "1.0.0",
  description: "Descripción del plugin EditCore",
  permissions: ["read_workspace"],
  connectors: [],
};

export async function listPlugins(): Promise<PluginManifest[]> {
  const root = workspaceRoot();
  if (!root) return [];
  const dir = path.join(root, PLUGINS_DIR);
  if (!fs.existsSync(dir)) return [];
  const result: PluginManifest[] = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json"))) {
    try {
      result.push(JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as PluginManifest);
    } catch {
      // skip
    }
  }
  return result;
}

export async function installPluginManifest(manifest: PluginManifest): Promise<void> {
  const root = workspaceRoot();
  if (!root) throw new Error("Sin workspace.");
  validatePluginManifest(manifest);
  const dir = path.join(root, PLUGINS_DIR);
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(
    path.join(dir, manifest.id + ".json"),
    JSON.stringify(manifest, null, 2) + "\n",
    "utf8"
  );
}

export function validatePluginManifest(m: PluginManifest): void {
  if (!m.id?.trim()) throw new Error("Plugin id requerido.");
  if (!m.name?.trim()) throw new Error("Plugin name requerido.");
  if (!m.version?.trim()) throw new Error("Plugin version requerido.");
  const allowed = ["read_workspace", "run_command", "network", "mcp", "secrets"];
  for (const p of m.permissions ?? []) {
    if (!allowed.includes(p)) {
      throw new Error("Permiso no permitido: " + p);
    }
  }
}

export function getPluginSdkDocumentation(): string {
  return [
    "# EditCore Plugin SDK v" + PLUGIN_SDK_VERSION,
    "",
    "## Manifest (plugin.json)",
    "```json",
    JSON.stringify(DEFAULT_PLUGIN_MANIFEST, null, 2),
    "```",
    "",
    "## Permisos",
    "- read_workspace — leer archivos del proyecto",
    "- run_command — ejecutar comandos (con aprobación)",
    "- network — llamadas HTTP externas",
    "- mcp — registrar servidor MCP",
    "- secrets — acceso a variables de entorno (restringido)",
    "",
    "## Ubicación",
    ".editcore/plugins/{id}.json",
  ].join("\n");
}
