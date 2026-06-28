# Autonomía real EditCore

_Generado: 2026-06-28T23:18:55.319Z_
_Producto v1.0.7 · extensión v1.4.0_

> **Pipeline real** — lectura directa del IDE, tareas derivadas de hallazgos, sin role-play.

## Estado: ⚠️ degraded

## Resumen ejecutivo (local, sin API)

EditCore **v1.0.7** (extensión 1.4.0) está **degraded**.

### Hallazgos

- **warning** — Instalador EditCoreUserSetup: Instalador más viejo (2026-06-28) que el portable.
- **warning** — Cambios sin commit: 106 archivo(s) con cambios.
- **info** — Modelo Claude: Modelo actual: claude-sonnet-4-6
- **info** — Servidores MCP: Sin servidores en .editcore/mcp.json ni en settings.
- **info** — Embeddings Voyage (opcional): Sin Voyage API Key — RAG usa solo keywords locales.
- **info** — .editcore/graph.json: No encontrado.
- **info** — Sesiones de agente: 2 sesión(es) guardada(s).

### Integraciones

- ✅ Claude (Anthropic) (sk-ant-...LgAA)
- ✅ OpenAI (sk-proj...aJoA)
- ✅ Modelos nativos EditCore (7 modelo(s) registrado(s))
- ⚪ Qdrant (RAG) (http://127.0.0.1:6333)
- ⚪ MCP (0 servidor(es) configurado(s))
- ⚪ EditCore Connect (no encontrada)

### Recomendaciones

- Para ejecutar mejoras reales: `editcore.autonomy.diagnose` o escribe «modo automejora» en el chat.
- Prompts listos para Cursor: `.editcore/autonomy/cursor-prompts.md`

---

## Tareas concretas (cola de automejora)

### 1. Autodiagnóstico completo (local)

- **ID:** `health-full-diagnostic`
- **Tipo:** investigate
- **Evidencia:** health.status=degraded
- **Ejecutable por agente:** sí

### 2. Cambios sin commit

- **ID:** `git-dirty-02`
- **Tipo:** investigate
- **Evidencia:** git.dirty: 106 archivo(s) con cambios.
- **Ejecutable por agente:** sí

### 3. Instalador EditCoreUserSetup

- **ID:** `build-installer-01`
- **Tipo:** investigate
- **Evidencia:** build.installer: Instalador más viejo (2026-06-28) que el portable.
- **Ejecutable por agente:** sí

### 4. .editcore/graph.json

- **ID:** `editcore-graph-06`
- **Tipo:** investigate
- **Evidencia:** editcore.graph: No encontrado.
- **Ejecutable por agente:** sí

### 5. Corregir configuración MCP

- **ID:** `mcp-config-04`
- **Tipo:** fix_config
- **Evidencia:** mcp.config: Sin servidores en .editcore/mcp.json ni en settings.
- **Ejecutable por agente:** sí

### 6. Corregir modelo Claude obsoleto

- **ID:** `api-model-03`
- **Tipo:** fix_config
- **Evidencia:** api.model: Modelo actual: claude-sonnet-4-6
- **Ejecutable por agente:** sí

### 7. Embeddings Voyage (opcional)

- **ID:** `rag-voyage-05`
- **Tipo:** investigate
- **Evidencia:** rag.voyage: Sin Voyage API Key — RAG usa solo keywords locales.
- **Ejecutable por agente:** sí

### 8. Sesiones de agente

- **ID:** `editcore-sessions-07`
- **Tipo:** investigate
- **Evidencia:** editcore.sessions: 2 sesión(es) guardada(s).
- **Ejecutable por agente:** sí


---

## Archivos generados

- Cola JSON: `d:/EDITCORE/.editcore/autonomy/queue.json`
- Prompts Cursor: `d:/EDITCORE/.editcore/autonomy/cursor-prompts.md`
- Mapa del sistema: `d:/EDITCORE/.editcore/docs/EDITCORE_SYSTEM_MAP.md`

## Cómo ejecutar

1. **En EditCore (Agent):** escribe `ejecuta las tareas de autonomía` — el agente usará herramientas reales.
2. **En Cursor:** abre `.editcore/autonomy/cursor-prompts.md` y pega cada bloque aquí.
3. **Comando:** `editcore.autonomy.execute` para la siguiente tarea pendiente.

**Comandos:** `editcore.autonomy.diagnose` · `editcore.autonomy.openQueue` · `editcore.intelligence.health`
