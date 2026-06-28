# EDITCORE System Map

**Generado:** 2026-06-28 (baseline estático v1.0.6)  
**Tipo:** Documentación de arquitectura — será actualizable por `editcore.intelligence.generateSystemMap` tras aprobación del plan SIL  
**Producto:** EditCore IDE — fork de Code-OSS con IA nativa

---

## 1. Vista general

EditCore es un IDE basado en **Code-OSS (VS Code)** con dos extensiones integradas de producto y una capa de orquestación IA propia.

```
┌────────────────────────────────────────────────────────────┐
│  EditCore Shell (editcore-src / VSCode-win32-x64)          │
│  • Workbench, Chat nativo, LM providers                    │
│  • Parches: scripts/patch-portable-*.js                    │
├────────────────────────────────────────────────────────────┤
│  editcore-claude (extensión principal)                     │
│  • Chat @claude • Agente • RAG • MCP • Diagnósticos        │
├────────────────────────────────────────────────────────────┤
│  editcore-connect (integraciones)                          │
│  • GitHub • Vercel • Supabase • Panel API keys             │
├────────────────────────────────────────────────────────────┤
│  Orchestrator middleware (orchestration/orchestrator.ts)   │
│  • Qdrant RAG • select_model • stats.json • autocrítica    │
├────────────────────────────────────────────────────────────┤
│  Build & Release (scripts/)                                │
│  • Portable • Inno Setup • GitHub Releases                 │
└────────────────────────────────────────────────────────────┘
```

---

## 2. Tecnologías utilizadas

| Capa | Tecnología |
|------|------------|
| Shell IDE | TypeScript, Electron, Code-OSS 1.85+ |
| Extensiones | VS Code Extension API, Webviews |
| IA — Claude | Anthropic SDK (`@anthropic-ai/sdk`) |
| IA — OpenAI | REST Chat Completions |
| IA — opcional | OpenRouter, Ollama (local) |
| Embeddings | Voyage AI API |
| Vector DB | Qdrant (HTTP, colección `editcore_code`) |
| Protocolo agente | MCP (stdio JSON-RPC) |
| Build Windows | PowerShell, Inno Setup, Python (iconos) |
| Web marketing | HTML estático (`web/`) |
| Versionado | `VERSION` + `scripts/sync-product-version.js` |

---

## 3. Módulos existentes

### 3.1 Repositorio raíz

| Ruta | Rol |
|------|-----|
| `VERSION` | Versión canónica del producto |
| `orchestrator.ts` | Copia raíz del orquestador (sincronizada con extensión) |
| `branding/` | `product.json`, iconos, settings por defecto |
| `scripts/` | Build, deploy, parches chat, release |
| `docs/` | DOWNLOAD, TERMS, PRIVACY, planes SIL |
| `web/` | Sitio descarga/marketing |
| `dist/` | Artefactos release (zip, setup) |
| `VSCode-win32-x64/` | Portable Windows compilado |
| `editcore-src/` | Árbol Code-OSS generado (no editar manualmente) |

### 3.2 Extensión `editcore-claude`

| Módulo | Ruta | Función |
|--------|------|---------|
| Activación | `src/extension.ts` | Registra chat, LM, comandos, índices |
| Chat nativo | `src/chatParticipant.ts` | Participante `@claude` (ask + agent) |
| LM provider | `src/languageModelProvider.ts` | Modelos vendor `editcore` |
| Router LLM | `src/aiRouter.ts` | Claude/OpenAI + fallback bidireccional |
| Cliente Claude | `src/anthropicClient.ts` | Messages API |
| Cliente OpenAI | `src/openaiClient.ts` | Chat Completions |
| API Keys | `src/apiKeyService.ts` | SecretStorage, usage, snapshot |
| Agente | `src/agent/agentLoop.ts` | Loop herramientas (max 30 iter) |
| Herramientas | `src/agent/tools.ts` | FS, git, MCP, diagnóstico |
| Orquestador UI | `src/agent/orchestrator.ts` | Plan → aprobación → agente |
| Orquestador MW | `src/orchestration/orchestrator.ts` | RAG, routing, telemetría |
| Invoke bridge | `src/orchestration/orchestratorInvoke.ts` | prepare() + enrich RAG |
| RAG local | `src/rag/chunkIndex.ts` | Chunks + cache `.editcore/rag/` |
| Voyage | `src/rag/voyageService.ts` | Embeddings híbridos |
| Índice keyword | `src/index/workspaceIndex.ts` | Búsqueda rápida workspace |
| MCP | `src/mcp/mcpClient.ts` | Servidores externos |
| Diagnósticos | `src/diagnostics/` | Self-diagnostic, checks, panel |
| Sesiones | `src/sessions/agentSessionStore.ts` | Historial agente |
| Observabilidad | `src/platform/observability.ts` | `observability.jsonl` |
| Memoria global | `src/global/globalMemory.ts` | Memoria extensión |
| Enterprise | `src/enterprise/orgConfig.ts` | Audit log |
| Cuenta & API | `src/configViewProvider.ts` | Webview configuración |
| Modelos | `src/models.ts` | Catálogo Claude/OpenAI |

### 3.3 Extensión `editcore-connect`

| Módulo | Ruta | Función |
|--------|------|---------|
| Panel Connect | `src/connectPanelProvider.ts` | GitHub, deploy |
| API Keys UI | `src/apiKeysPanelProvider.ts` | Bridge a Claude secrets |
| GitHub | `src/githubService.ts` | OAuth + `gh` CLI |
| Vercel | `src/vercelService.ts` | Deploy |
| Supabase | `src/supabaseAccountStore.ts` | Link proyectos |
| Migración keys | `src/connectSecretsMigration.ts` | Connect → Claude storage |

---

## 4. Dependencias

### 4.1 npm (editcore-claude)

- `@anthropic-ai/sdk` — API Claude
- Dependencias de compilación TypeScript

### 4.2 APIs externas (requieren red + keys)

| Servicio | Endpoint | Config |
|----------|----------|--------|
| Anthropic | `https://api.anthropic.com` | SecretStorage `anthropicApiKey` |
| OpenAI | `https://api.openai.com/v1` | SecretStorage `openaiApiKey` |
| Voyage | `https://api.voyageai.com/v1/embeddings` | `voyageApiKey` |
| Qdrant | `http://127.0.0.1:6333` (default) | `editcore.orchestrator.qdrantUrl` |
| OpenRouter | API OpenRouter | `openrouterApiKey` (opcional) |
| Ollama | Local | `editcore.ollama.enabled` |

### 4.3 Servicios opcionales

- **MCP servers** — definidos en `.editcore/mcp.json`
- **GitHub / Vercel / Supabase** — vía Connect + CLI

### 4.4 Sin base de datos tradicional

Persistencia = **archivos** + **VS Code storage** (SecretStorage, globalState, globalStorage).

---

## 5. Flujos principales

### 5.1 Chat — modo Ask (sin herramientas)

```
Usuario → @claude (ask)
  → chatParticipant.ts
  → shouldUseAgentLoop() = false
  → streamForSelectedModel() [respeta modelo elegido]
  → enrichWithOrchestratorRag() [si orchestrator.enabled]
  → streamClaude / streamOpenAI
  → fallback bidireccional si falla proveedor
```

### 5.2 Chat — modo Agent (con herramientas)

```
Usuario → @claude (agent) o workspace abierto
  → handleAgentRequest()
  → Rama A: multiAgent (Architect→Dev→QA→DevOps)
  → Rama B: orchestrator UI (plan + aprobación)
  → Rama C: agentLoop.ts (default)
  → tools.ts (read_file, git_*, call_mcp, run_self_diagnostic…)
  → sessionStore → .editcore/sessions/
  → audit.jsonl
```

### 5.3 Orquestador middleware (RAG + routing)

```
Mensaje + taskHint
  → tryPrepareOrchestration()
  → retrieveContext (Qdrant o fallback local)
  → select_model (Claude-first desde v1.0.6)
  → enrichMessagesWithRag()
  → invokeOrchestratedStream/Completion
  → logPerformanceMetrics → .editcore/stats.json
```

### 5.4 Indexación RAG

```
Abrir workspace / guardar archivo
  → workspaceIndex (keyword) → .editcore/index-cache.json
  → chunkIndex (RAG) → .editcore/rag/index.json
  → [opcional] Qdrant upsert
```

### 5.5 Build & deploy

```
scripts/build-editcore.ps1
  → editcore-src (Code-OSS)
  → merge branding/product.json
  → copiar extensiones
  → parches chat
  → npm compile

scripts/package-release.ps1
  → compile extensiones
  → deploy-extensions-to-portable.ps1
  → zip portable + setup Inno
  → releases/latest.json
```

### 5.6 Diagnóstico / Self Awareness actual

```
editcore.selfDiagnostic
  → diagnosticService.ts
  → checks: editcoreChecks + workspaceChecks
  → .editcore/diagnostics/last-run.json|.md
  → [opcional] análisis Claude
```

---

## 6. Almacenamiento por workspace (`.editcore/`)

| Archivo / carpeta | Contenido |
|-------------------|-----------|
| `rules.md` | Reglas del proyecto para el agente |
| `memory.md` | Memoria de contexto proyecto |
| `mcp.json` | Servidores MCP |
| `org.json` | Config organización |
| `stats.json` | Telemetría orquestador (metadatos) |
| `diagnostics/` | Último self-diagnostic |
| `audit.jsonl` | Log auditoría append-only |
| `sessions/` | Sesiones agente |
| `rag/` | Cache índice RAG |
| `adrs/` | Architecture Decision Records |
| `graph.json` | Gemelo digital (dependencias) |

---

## 7. Configuración clave (`editcore.*`)

| Setting | Default | Efecto |
|---------|---------|--------|
| `editcore.model` | `claude-sonnet-4-6` | Modelo Claude |
| `editcore.openai.model` | `gpt-4o` | Modelo OpenAI |
| `editcore.fallback.enabled` | `true` | Fallback entre proveedores |
| `editcore.orchestrator.enabled` | `false` | RAG middleware + plan agente |
| `editcore.agent.alwaysWhenWorkspaceOpen` | `true` | Agent loop con workspace |
| `editcore.multiAgent.enabled` | `false` | Pipeline multi-agente |
| `editcore.rag.useEmbeddings` | — | Voyage hybrid RAG |

---

## 8. Comandos de introspección existentes

| Comando | Atajo | Función |
|---------|-------|---------|
| `editcore.selfDiagnostic` | Ctrl+Alt+D | Diagnóstico completo |
| `editcore.selfDiagnostic.quick` | — | Solo checks locales |
| `editcore.productHealth` | — | Versión, licencia, updates |
| `editcore.diagnoseNativeModels` | — | Lista modelos LM nativos |
| `editcore.observability` | — | Eventos recientes |
| `editcore.repairChat` | — | Migrar modelo + limpiar cache |

---

## 9. Próxima evolución (SIL — pendiente aprobación)

Tras aprobar `EDITCORE_SELF_AWARENESS_PLAN.md`:

- `editcore.intelligence.health` — Health Monitor unificado
- `editcore.intelligence.generateSystemMap` — Regeneración automática de este documento
- `.editcore/tech-memory/` — Memoria técnica del sistema
- Permission Gate — lectura por defecto, escritura con aprobación

---

## 10. Versión y sincronización

| Artefacto | Versión actual |
|-----------|----------------|
| Producto | 1.0.6 (`VERSION`) |
| editcore-claude | 1.0.6 |
| editcore-connect | 1.0.6 |
| Último commit relevante | Fix chat routing + fallback bidireccional |

---

*Este mapa es un snapshot estático. Para el diseño de auto-actualización, ver `docs/EDITCORE_SELF_AWARENESS_PLAN.md`.*
