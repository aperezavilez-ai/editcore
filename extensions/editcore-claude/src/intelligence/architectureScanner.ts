import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import type { SystemModuleInfo } from "./types";

const MODULE_CATALOG: Array<Omit<SystemModuleInfo, "path">> = [
  { id: "shell", name: "EditCore Shell", role: "Workbench Code-OSS + parches chat" },
  { id: "editcore-claude", name: "editcore-claude", role: "Chat, agente, RAG, diagnósticos" },
  { id: "editcore-connect", name: "editcore-connect", role: "GitHub, Vercel, Supabase, API keys UI" },
  { id: "chat", name: "Chat Participant", role: "Participante @claude (ask/agent)" },
  { id: "lm-provider", name: "Language Model Provider", role: "Modelos nativos vendor editcore" },
  { id: "ai-router", name: "AI Router", role: "Claude/OpenAI + fallback bidireccional" },
  { id: "agent-loop", name: "Agent Loop", role: "Herramientas FS, git, MCP" },
  { id: "orchestrator-mw", name: "Orchestrator Middleware", role: "RAG Qdrant, select_model, stats.json" },
  { id: "orchestrator-ui", name: "Orchestrator UI", role: "Plan y aprobación en modo Agent" },
  { id: "rag", name: "RAG Index", role: "Chunks locales + Voyage embeddings" },
  { id: "mcp", name: "MCP Client", role: "Servidores MCP stdio" },
  { id: "diagnostics", name: "Self Diagnostic", role: "Checks IDE + workspace" },
  { id: "intelligence", name: "System Intelligence", role: "Snapshot, health, permisos (SIL)" },
  { id: "build", name: "Build Pipeline", role: "scripts/build-editcore, package-release" },
];

const MODULE_PATHS: Record<string, string> = {
  shell: "editcore-src",
  "editcore-claude": "extensions/editcore-claude",
  "editcore-connect": "extensions/editcore-connect",
  chat: "extensions/editcore-claude/src/chatParticipant.ts",
  "lm-provider": "extensions/editcore-claude/src/languageModelProvider.ts",
  "ai-router": "extensions/editcore-claude/src/aiRouter.ts",
  "agent-loop": "extensions/editcore-claude/src/agent/agentLoop.ts",
  "orchestrator-mw": "extensions/editcore-claude/src/orchestration/orchestrator.ts",
  "orchestrator-ui": "extensions/editcore-claude/src/agent/orchestrator.ts",
  rag: "extensions/editcore-claude/src/rag/chunkIndex.ts",
  mcp: "extensions/editcore-claude/src/mcp/mcpClient.ts",
  diagnostics: "extensions/editcore-claude/src/diagnostics",
  intelligence: "extensions/editcore-claude/src/intelligence",
  build: "scripts/package-release.ps1",
};

export function listArchitectureModules(extensionPath: string): SystemModuleInfo[] {
  const repoRoot = resolveRepoRoot(extensionPath);
  return MODULE_CATALOG.map((module) => {
    const relative = MODULE_PATHS[module.id] ?? "";
    const absolute = repoRoot ? path.join(repoRoot, relative) : path.join(extensionPath, "..", relative);
    return {
      ...module,
      path: relative || absolute,
    };
  });
}

function resolveRepoRoot(extensionPath: string): string | undefined {
  let current = extensionPath;
  for (let i = 0; i < 6; i++) {
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    const versionFile = path.join(parent, "VERSION");
    const scriptsDir = path.join(parent, "scripts");
    try {
      if (fs.existsSync(versionFile) && fs.existsSync(scriptsDir)) {
        return parent;
      }
    } catch {
      // ignore
    }
    current = parent;
  }
  const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  return folder;
}

export const PRIMARY_FLOWS = [
  "Chat Ask → streamForSelectedModel → Claude/OpenAI",
  "Chat Agent → agentLoop / multiAgent / orchestrator UI",
  "RAG → chunkIndex + optional Qdrant (orchestrator.prepare)",
  "MCP → loadMcpServers → McpManager",
  "Self Diagnostic → editcoreChecks + workspaceChecks",
  "SIL → systemReader + healthMonitor (read-only)",
];
