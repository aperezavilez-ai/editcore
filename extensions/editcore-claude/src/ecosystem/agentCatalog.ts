/**
 * Catálogo unificado de agentes — Fase 3 (Prompt 6).
 */
import * as vscode from "vscode";
import { MarketplaceService } from "../marketplace/marketplaceService";
import { listCustomAgents, customAgentToSystemPrompt } from "./agentBuilder";
import type { CustomAgentDefinition } from "./types";

export interface CatalogAgent {
  id: string;
  name: string;
  source: "builtin" | "marketplace" | "custom";
  mention?: string;
  description: string;
  tier?: string;
}

const BUILTIN_AGENTS: CatalogAgent[] = [
  { id: "frontend", name: "Frontend Agent", source: "builtin", mention: "fullstack", description: "React, Vue, UI/UX, componentes" },
  { id: "backend", name: "Backend Agent", source: "builtin", mention: "fullstack", description: "APIs, servicios, lógica de negocio" },
  { id: "database", name: "Database Agent", source: "builtin", mention: "architect", description: "SQL, ORM, migraciones, modelos" },
  { id: "security", name: "Security Agent", source: "builtin", mention: "security", description: "OWASP, auth, secretos" },
  { id: "testing", name: "Testing Agent", source: "builtin", mention: "qa", description: "Unit, integration, E2E" },
  { id: "devops", name: "DevOps Agent", source: "builtin", mention: "devops", description: "CI/CD, Docker, deploy" },
  { id: "marketing", name: "Marketing Agent", source: "builtin", mention: "founder", description: "Copy, landing, growth" },
  { id: "documentation", name: "Documentation Agent", source: "builtin", mention: "documenter", description: "Docs, README, ADRs" },
];

export async function loadUnifiedAgentCatalog(extensionUri: vscode.Uri): Promise<CatalogAgent[]> {
  const service = new MarketplaceService(extensionUri);
  const catalog = await service.getCatalog();
  const marketplaceAgents: CatalogAgent[] = catalog.items
    .filter((i) => i.type === "agent")
    .map((i) => ({
      id: i.id,
      name: i.name,
      source: "marketplace" as const,
      mention: i.role,
      description: i.description,
      tier: i.tier,
    }));

  const custom: CatalogAgent[] = (await listCustomAgents()).map((a) => ({
    id: a.id,
    name: a.name,
    source: "custom" as const,
    mention: "custom:" + a.id,
    description: a.objective,
  }));

  return [...BUILTIN_AGENTS, ...marketplaceAgents, ...custom];
}

export async function resolveCustomAgentPrompt(agentId: string): Promise<string | undefined> {
  const agents = await listCustomAgents();
  const agent = agents.find((a) => a.id === agentId);
  if (!agent) return undefined;
  return customAgentToSystemPrompt(agent);
}

export function parseCustomMention(prompt: string): { agentId: string; cleanPrompt: string } | undefined {
  const match = prompt.match(/^@custom:([a-z0-9_-]+)\b\s*/i);
  if (!match?.[1]) return undefined;
  return { agentId: match[1], cleanPrompt: prompt.slice(match[0].length).trim() };
}
