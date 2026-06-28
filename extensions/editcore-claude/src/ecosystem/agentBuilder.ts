/**
 * Agent Builder — Fase 4 (Prompt 6).
 */
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { appendAudit } from "../enterprise/orgConfig";
import type { CustomAgentDefinition } from "./types";

const CUSTOM_DIR = path.join(".editcore", "agents", "custom");

function workspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

export async function listCustomAgents(): Promise<CustomAgentDefinition[]> {
  const root = workspaceRoot();
  if (!root) return [];
  const dir = path.join(root, CUSTOM_DIR);
  if (!fs.existsSync(dir)) return [];
  const files = await fs.promises.readdir(dir);
  const agents: CustomAgentDefinition[] = [];
  for (const f of files.filter((x) => x.endsWith(".json"))) {
    try {
      agents.push(JSON.parse(await fs.promises.readFile(path.join(dir, f), "utf8")) as CustomAgentDefinition);
    } catch {
      // skip
    }
  }
  return agents;
}

export async function saveCustomAgent(def: Omit<CustomAgentDefinition, "createdAt" | "updatedAt" | "id"> & { id?: string }): Promise<CustomAgentDefinition> {
  const root = workspaceRoot();
  if (!root) throw new Error("Sin workspace.");

  const id = def.id ?? "agent-" + Date.now();
  const now = new Date().toISOString();
  const full: CustomAgentDefinition = {
    ...def,
    id,
    createdAt: now,
    updatedAt: now,
    tools: def.tools ?? ["read_file", "search_files", "apply_patch"],
    permissions: def.permissions ?? ["view_projects", "edit_code", "run_agents"],
    memoryEnabled: def.memoryEnabled ?? true,
    visibility: def.visibility ?? "private",
    author: def.author ?? "local",
    rating: def.rating ?? 0,
  };

  const dir = path.join(root, CUSTOM_DIR);
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(path.join(dir, id + ".json"), JSON.stringify(full, null, 2) + "\n", "utf8");

  const mdPath = path.join(dir, id + ".md");
  await fs.promises.writeFile(
    mdPath,
    "# " + full.name + "\n\n## Objetivo\n" + full.objective + "\n\n## Instrucciones\n" + full.instructions + "\n",
    "utf8"
  );

  await appendAudit({ event: "agent_created", agentId: id, name: full.name });
  return full;
}

export async function runAgentBuilderWizard(): Promise<CustomAgentDefinition | undefined> {
  const name = await vscode.window.showInputBox({ title: "Agent Builder", prompt: "Nombre del agente" });
  if (!name?.trim()) return undefined;

  const objective = await vscode.window.showInputBox({ title: "Agent Builder", prompt: "Objetivo" });
  if (!objective?.trim()) return undefined;

  const model = await vscode.window.showQuickPick(
    [
      { label: "Auto (por tarea)", id: "auto" as const },
      { label: "Claude", id: "anthropic" as const },
      { label: "OpenAI", id: "openai" as const },
    ],
    { title: "Modelo IA" }
  );
  if (!model) return undefined;

  const instructions = await vscode.window.showInputBox({
    title: "Agent Builder",
    prompt: "Instrucciones del sistema",
    value: "Eres un agente especializado en: " + objective,
  });
  if (!instructions?.trim()) return undefined;

  const visibility = await vscode.window.showQuickPick(
    [
      { label: "Privado", id: "private" as const },
      { label: "Equipo", id: "team" as const },
      { label: "Público (marketplace local)", id: "public" as const },
    ],
    { title: "Visibilidad" }
  );

  return saveCustomAgent({
    name: name.trim(),
    objective: objective.trim(),
    model: model.id,
    instructions: instructions.trim(),
    visibility: visibility?.id ?? "private",
    tools: ["read_file", "search_files", "apply_patch", "run_command"],
    permissions: ["view_projects", "edit_code", "run_agents"],
    memoryEnabled: true,
    author: "user",
  });
}

export function customAgentToSystemPrompt(agent: CustomAgentDefinition): string {
  return [
    "Agente personalizado: " + agent.name,
    "Objetivo: " + agent.objective,
    "Modelo preferido: " + agent.model,
    "Herramientas: " + agent.tools.join(", "),
    "",
    agent.instructions,
    agent.workflow?.length ? "\nFlujo:\n" + agent.workflow.map((s, i) => (i + 1) + ". " + s).join("\n") : "",
  ].join("\n");
}
