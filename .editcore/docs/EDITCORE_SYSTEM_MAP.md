# EDITCORE System Map (generado en vivo)

_Generado: 2026-06-28T23:18:55.318Z_
_Producto v1.0.7 · Extensión v1.4.0_
_Estado: Degradado_

> Documento generado automáticamente por EditCore System Intelligence Layer.
> No editar manualmente si vas a regenerar; usa `editcore.intelligence.generateSystemMap`.

# EditCore System Snapshot

**Generado:** 2026-06-28T23:18:55.137Z
**Producto:** 1.0.7 · **Extensión:** 1.4.0
**VS Code:** 1.126.0

**Workspace:** EDITCORE

## Integraciones

- ✅ **Claude (Anthropic)** — sk-ant-...LgAA
- ✅ **OpenAI** — sk-proj...aJoA
- ✅ **Modelos nativos EditCore** — 7 modelo(s) registrado(s)
- ⚪ **Qdrant (RAG)** — http://127.0.0.1:6333
- ⚪ **MCP** — 0 servidor(es) configurado(s)
- ⚪ **EditCore Connect** — no encontrada

## Módulos

- **EditCore Shell** (`shell`) — Workbench Code-OSS + parches chat
  - `editcore-src`
- **editcore-claude** (`editcore-claude`) — Chat, agente, RAG, diagnósticos
  - `extensions/editcore-claude`
- **editcore-connect** (`editcore-connect`) — GitHub, Vercel, Supabase, API keys UI
  - `extensions/editcore-connect`
- **Chat Participant** (`chat`) — Participante @claude (ask/agent)
  - `extensions/editcore-claude/src/chatParticipant.ts`
- **Language Model Provider** (`lm-provider`) — Modelos nativos vendor editcore
  - `extensions/editcore-claude/src/languageModelProvider.ts`
- **AI Router** (`ai-router`) — Claude/OpenAI + fallback bidireccional
  - `extensions/editcore-claude/src/aiRouter.ts`
- **Agent Loop** (`agent-loop`) — Herramientas FS, git, MCP
  - `extensions/editcore-claude/src/agent/agentLoop.ts`
- **Orchestrator Middleware** (`orchestrator-mw`) — RAG Qdrant, select_model, stats.json
  - `extensions/editcore-claude/src/orchestration/orchestrator.ts`
- **Orchestrator UI** (`orchestrator-ui`) — Plan y aprobación en modo Agent
  - `extensions/editcore-claude/src/agent/orchestrator.ts`
- **RAG Index** (`rag`) — Chunks locales + Voyage embeddings
  - `extensions/editcore-claude/src/rag/chunkIndex.ts`
- **MCP Client** (`mcp`) — Servidores MCP stdio
  - `extensions/editcore-claude/src/mcp/mcpClient.ts`
- **Self Diagnostic** (`diagnostics`) — Checks IDE + workspace
  - `extensions/editcore-claude/src/diagnostics`
- **System Intelligence** (`intelligence`) — Snapshot, health, permisos (SIL)
  - `extensions/editcore-claude/src/intelligence`
- **Build Pipeline** (`build`) — scripts/build-editcore, package-release
  - `scripts/package-release.ps1`

## Flujos principales

- Chat Ask → streamForSelectedModel → Claude/OpenAI
- Chat Agent → agentLoop / multiAgent / orchestrator UI
- RAG → chunkIndex + optional Qdrant (orchestrator.prepare)
- MCP → loadMcpServers → McpManager
- Self Diagnostic → editcoreChecks + workspaceChecks
- SIL → systemReader + healthMonitor (read-only)

## Settings (redacted)

```json
{
  "model": "claude-sonnet-4-6",
  "openai.model": "gpt-4o",
  "fallback.enabled": true,
  "orchestrator.enabled": false,
  "multiAgent.enabled": false,
  "router.autoSelect": false,
  "agent.alwaysWhenWorkspaceOpen": true,
  "rag.useEmbeddings": true,
  "intelligence.enabled": true,
  "intelligence.permissionLevel": "write_docs",
  "ollama.enabled": false,
  "diagnostics.useClaude": true
}
```

## API Keys (solo hints)

- Claude: sk-ant-...LgAA
- OpenAI: sk-proj...aJoA
- OpenRouter: no configurada

---

# EDITCORE Health Monitor

**Estado:** ⚠️ Degradado
**Generado:** 2026-06-28T23:18:55.296Z

## Resumen diagnóstico

- Críticos: 0
- Advertencias: 2
- Info: 5
- OK: 17

## Servicios

- **editcore-claude** [ok]: Extensión activa
- **editcore-connect** [unknown]: No instalada
- **API Keys** [ok]: Al menos una key LLM configurada
- **MCP** [unknown]: Sin servidores MCP configurados
- **Telemetría orchestrator** [unknown]: stats.json no disponible

## Rendimiento (stats.json)

- Sin datos de telemetría en el workspace actual.

## MCP

- Configurados: 0
- Conectados: 0
- Herramientas: 0

## Eventos recientes (observability)

- [2026-06-28T21:36:16.765Z] **info** intelligence: pipeline_completed
- [2026-06-28T21:34:23.618Z] **info** intelligence: pipeline_completed
- [2026-06-28T21:10:36.302Z] **info** intelligence: pipeline_completed
- [2026-06-28T21:08:23.934Z] **info** intelligence: pipeline_completed

## Hallazgos

- **WARNING** Instalador EditCoreUserSetup: Instalador más viejo (2026-06-28) que el portable.
  - _Regenerá con scripts\build-win-installer.ps1 -SetupOnly_
- **WARNING** Cambios sin commit: 106 archivo(s) con cambios.
  - _ M branding/default-settings.json
 M branding/icons/app-icon-source.svg
 M branding/icons/editcore-icon.svg
 M branding/icons/editcore-logo-512.png
 M branding/icons/editcore-logo-web.png
 M branding/icons/editcore-logo.png_
- **INFO** Modelo Claude: Modelo actual: claude-sonnet-4-6
- **INFO** Servidores MCP: Sin servidores en .editcore/mcp.json ni en settings.
  - _Opcional: agregá MCP para herramientas externas._
- **INFO** Embeddings Voyage (opcional): Sin Voyage API Key — RAG usa solo keywords locales.
- **INFO** .editcore/graph.json: No encontrado.
- **INFO** Sesiones de agente: 2 sesión(es) guardada(s).