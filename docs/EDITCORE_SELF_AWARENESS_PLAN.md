# EDITCORE Self Awareness Plan

**Versión del plan:** 1.0  
**Fecha:** 2026-06-28  
**Estado:** ✅ Sprint 1 implementado (v1.0.7) — read-only activo con `editcore.intelligence.enabled`

---

## 1. Resumen ejecutivo

Este plan define la **EDITCORE System Intelligence Layer (SIL)**: una capa de conocimiento interno que permite a EditCore **leer, analizar y documentar su propio funcionamiento** de forma segura, sin acciones autónomas ni cambios destructivos en la fase inicial.

**Principio rector:** *lectura primero, escritura solo con aprobación humana.*

La SIL no reemplaza el orquestador ni el agente existentes. Se integra como **observador y documentador** encima de señales ya presentes en el repositorio (diagnósticos, telemetría, audit log, sesiones, configuración).

---

## 2. Objetivos

| # | Objetivo | Entregable |
|---|----------|------------|
| 1 | Lectura controlada de arquitectura | `SystemIntelligenceReader` (nuevo módulo) |
| 2 | Documentación automática del sistema | `EDITCORE_SYSTEM_MAP.md` (generado/actualizado) |
| 3 | Observabilidad operativa | `EDITCORE HEALTH MONITOR` |
| 4 | Memoria técnica evolutiva | `EDITCORE TECH MEMORY` |
| 5 | Permisos seguros por capas | `PermissionGate` + política de aprobación |

---

## 3. Arquitectura propuesta

```
┌─────────────────────────────────────────────────────────────────┐
│                     EditCore IDE (usuario)                        │
├─────────────────────────────────────────────────────────────────┤
│  Chat / Agente existente  ──►  (sin cambios en fase 1)          │
├─────────────────────────────────────────────────────────────────┤
│           EDITCORE SYSTEM INTELLIGENCE LAYER (NUEVO)            │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ System       │  │ Health       │  │ Tech Memory          │  │
│  │ Intelligence │  │ Monitor      │  │ Store                │  │
│  │ Reader       │  │              │  │                      │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                 │                      │              │
│         └────────┬────────┴──────────────────────┘              │
│                  ▼                                              │
│         ┌─────────────────┐                                     │
│         │ Permission Gate │  READ (default) │ WRITE (approval) │
│         └────────┬────────┘                                     │
│                  ▼                                              │
│         ┌─────────────────┐                                     │
│         │ Doc Generator   │ ──► EDITCORE_SYSTEM_MAP.md         │
│         └─────────────────┘                                     │
├─────────────────────────────────────────────────────────────────┤
│  Fuentes de datos (solo lectura en fase 1)                      │
│  • package.json / product.json / VERSION                        │
│  • .editcore/stats.json, diagnostics/, audit.jsonl            │
│  • globalStorage/observability.jsonl, global-memory.json      │
│  • ApiKeyService.getSnapshot() (sin exponer keys)               │
│  • editcore.selfDiagnostic pipeline existente                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Componentes a construir

### 4.1 System Intelligence Reader

**Responsabilidad:** Recopilar un snapshot estructurado del sistema en tiempo de ejecución.

**Ámbitos de lectura:**

| Dominio | Qué lee | Fuente actual |
|---------|---------|---------------|
| Frontend | Workbench, chat patches, webviews | `editcore-src/`, parches en `scripts/patch-portable-*.js` |
| Extensiones | Manifests, comandos, settings | `extensions/editcore-claude/`, `extensions/editcore-connect/` |
| Backend lógico | Routers, clientes API, orquestador | `src/aiRouter.ts`, `orchestration/`, `providers/` |
| APIs externas | Endpoints configurados (sin llamar con datos sensibles) | `llmConfig.ts`, `voyageService.ts`, Qdrant config |
| Almacenamiento | Capas de persistencia | SecretStorage (metadatos), globalState, `.editcore/` |
| Integraciones | MCP, GitHub, Vercel, Supabase | `editcore-connect/`, `mcp/` |
| Servicios | Estado activación extensiones, modelos nativos | `extension.ts`, `diagnosticService.ts` |

**Salida:** `SystemSnapshot` (JSON tipado, sin secretos).

**Ubicación propuesta (nuevo):**
```
extensions/editcore-claude/src/intelligence/
├── types.ts
├── systemReader.ts
├── architectureScanner.ts
├── integrationProbe.ts
└── index.ts
```

---

### 4.2 Document Generator → `EDITCORE_SYSTEM_MAP.md`

**Responsabilidad:** Transformar `SystemSnapshot` + escaneo estático del repo en documentación Markdown versionada.

**Contenido obligatorio del mapa:**
- Arquitectura actual (capas y diagrama)
- Tecnologías utilizadas
- Módulos existentes con rutas
- Dependencias (npm, APIs, servicios opcionales)
- Flujos principales (chat ask, agent, RAG, MCP, build)

**Ubicación del artefacto generado:**
- Workspace abierto: `.editcore/docs/EDITCORE_SYSTEM_MAP.md`
- Repo EditCore (modo dev): `docs/EDITCORE_SYSTEM_MAP.md` (baseline manual + diff opcional)

**Comando propuesto:** `editcore.intelligence.generateSystemMap`  
**Frecuencia:** manual en fase 1; programable en fase 2 (post-aprobación).

**Archivo baseline ya creado:** `docs/EDITCORE_SYSTEM_MAP.md` (snapshot estático v1.0.6).

---

### 4.3 EDITCORE Health Monitor

**Responsabilidad:** Agregar señales de salud en un panel/consulta unificada.

**Métricas a recopilar:**

| Categoría | Señales | Fuente |
|-----------|---------|--------|
| Estado servicios | Extensiones activas, LM provider, MCP conectados | `diagnosticRuntime`, `mcpClient.ts` |
| Errores | Último diagnóstico, findings críticos | `.editcore/diagnostics/last-run.json` |
| Rendimiento | Latencia, tokens, modelo usado | `.editcore/stats.json` |
| Recursos | Sesiones activas, índice RAG, tamaño cache | `agentSessionStore`, `chunkIndex` |

**Salida:** `HealthReport` + opcional `.editcore/health/latest.json`

**Ubicación propuesta (nuevo):**
```
extensions/editcore-claude/src/intelligence/
├── healthMonitor.ts
├── healthTypes.ts
└── healthPanel.ts          # Webview o comando que muestra resumen
```

**Comando propuesto:** `editcore.intelligence.health`  
**Reutiliza:** `editcore.selfDiagnostic.quick` (no duplicar lógica; envolver).

---

### 4.4 EDITCORE Tech Memory

**Responsabilidad:** Memoria técnica append-only de decisiones, cambios y configuración relevante.

**Qué guarda:**

| Tipo | Ejemplo | Formato |
|------|---------|---------|
| Decisiones arquitectura | "Router Claude-first en v1.0.6" | ADR ligero |
| Cambios realizados | Commit hash + resumen | Entrada cronológica |
| Configuración | Snapshot de `editcore.*` (sin keys) | JSON redacted |
| Evolución | Versión producto, releases | Timeline |

**Ubicación de almacenamiento:**
```
.editcore/tech-memory/
├── index.json           # índice de entradas
├── entries/
│   └── YYYY-MM-DD-*.json
└── timeline.md          # vista humana (generada)
```

**Relación con existentes:**
- Complementa `.editcore/memory.md` (memoria de proyecto para el agente)
- Complementa `global-memory.json` (memoria global de extensión)
- No reemplaza `audit.jsonl` (eventos operativos)

**Escritura:** solo vía `TechMemoryStore.append()` detrás de `PermissionGate`.

---

### 4.5 Permission Gate (seguridad)

**Modelo de permisos:**

```
Nivel 0 — READ_ONLY (default)
  ✓ Leer arquitectura, configs redacted, stats, diagnostics
  ✓ Generar documentación en .editcore/docs/
  ✗ Modificar código, settings, secrets, ejecutar tools destructivos

Nivel 1 — WRITE_DOCS (auto en fase 2, opcional)
  ✓ Actualizar SYSTEM_MAP, tech-memory, timeline
  ✗ Modificar src/, package.json, product.json

Nivel 2 — WRITE_CONFIG (requiere aprobación UI)
  ✓ Actualizar editcore.* settings no sensibles
  ✗ SecretStorage, git push, write_file en repo

Nivel 3 — WRITE_CODE (requiere aprobación explícita + confirmación)
  ✓ Delegar al agent loop existente con guardrails
  ✗ Nunca autónomo sin human-in-the-loop
```

**Implementación propuesta:**
```typescript
// intelligence/permissionGate.ts
type IntelligencePermission = 'read' | 'write_docs' | 'write_config' | 'write_code';

async function requestPermission(
  level: IntelligencePermission,
  reason: string
): Promise<boolean>;  // vscode.window.showWarningMessage + modal
```

**Regla:** La IA del chat **no** obtiene nivel > 0 automáticamente. El usuario aprueba por acción.

---

## 5. Qué archivos afecta (por fase)

### Fase 0 — Solo documentación ✅ (esta entrega)
| Archivo | Acción |
|---------|--------|
| `docs/EDITCORE_SELF_AWARENESS_PLAN.md` | **Creado** (este documento) |
| `docs/EDITCORE_SYSTEM_MAP.md` | **Creado** (baseline estático) |
| Código existente | **Sin cambios** |

### Fase 1 — Lectura + Health (post-aprobación)
| Archivo | Acción |
|---------|--------|
| `extensions/editcore-claude/src/intelligence/*` | **Nuevo** (~6–8 archivos) |
| `extensions/editcore-claude/src/extension.ts` | **Mínimo:** registrar comandos nuevos |
| `extensions/editcore-claude/package.json` | **Mínimo:** contributes commands + config `editcore.intelligence.*` |
| Código de chat/agent/orchestrator | **Sin cambios** |

### Fase 2 — Tech Memory + generación automática
| Archivo | Acción |
|---------|--------|
| `.editcore/tech-memory/` | **Nuevo** (runtime, gitignored parcial) |
| `extensions/editcore-claude/src/intelligence/docGenerator.ts` | **Nuevo** |
| `extensions/editcore-claude/src/agent/tools.ts` | **Opcional:** tool `intelligence_snapshot` (read-only) |

### Fase 3 — Integración agente (opcional, post-aprobación)
| Archivo | Acción |
|---------|--------|
| `chatParticipant.ts` | **Opcional:** inyectar contexto SIL en system prompt |
| `orchestrator.ts` | **Sin cambios** en routing; solo lectura de health |

**Archivos que NO se tocarán sin aprobación explícita adicional:**
- `editcore-src/` (shell Code-OSS)
- `scripts/patch-portable-*.js`
- `apiKeyService.ts` (solo lectura de snapshot)
- SecretStorage / migraciones de keys

---

## 6. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Exposición de API keys en snapshots | Crítico | `redactSecrets()` obligatorio; solo hints (`sk-ant-...xxxx`) |
| IA modifica código sin aprobación | Alto | Permission Gate; fase 1 read-only |
| Duplicar lógica de diagnósticos | Medio | Envolver `diagnosticService`, no reimplementar |
| Confusión `orchestrator.enabled` dual | Medio | Documentar en SYSTEM_MAP; SIL no lo modifica |
| Generación SYSTEM_MAP desactualizada | Bajo | Timestamp + versión en header; comando manual |
| Escritura en `.editcore/` sin control | Medio | Solo `docs/` y `tech-memory/` permitidos en fase 2 |
| Performance al escanear repo grande | Medio | Cache 5 min; escaneo incremental por globs |
| Fuga de prompts/código en telemetría | Alto | Reutilizar política de `stats.json` (solo metadatos) |

---

## 7. Plan de implementación (tras aprobación)

### Sprint 1 — Fundación read-only (estimado: 1–2 días)
1. Crear `src/intelligence/types.ts` con interfaces `SystemSnapshot`, `HealthReport`, `TechMemoryEntry`
2. Implementar `systemReader.ts` (lectura manifests, settings redacted, versión)
3. Implementar `healthMonitor.ts` (agregar diagnostic quick + stats + MCP status)
4. Registrar `editcore.intelligence.health` y `editcore.intelligence.snapshot`
5. Tests unitarios de redacción de secretos

### Sprint 2 — Documentación automática (estimado: 1 día)
1. `docGenerator.ts` → genera `.editcore/docs/EDITCORE_SYSTEM_MAP.md`
2. Comando `editcore.intelligence.generateSystemMap`
3. Diff opcional vs baseline en `docs/`

### Sprint 3 — Tech Memory (estimado: 1–2 días)
1. `techMemoryStore.ts` append-only con index
2. Hook post-commit local (opcional, manual trigger primero)
3. Vista timeline en webview o markdown export

### Sprint 4 — Integración UI (estimado: 1 día)
1. Panel "System Intelligence" en sidebar EditCore (opcional)
2. Documentar en welcome / command hub

**Criterios de aceptación fase 1:**
- [ ] Comando health devuelve reporte sin secretos
- [ ] Snapshot lista módulos y flujos correctamente
- [ ] Cero modificaciones al agent loop / chat routing
- [ ] Cero escrituras automáticas en código fuente

---

## 8. Configuración propuesta (`editcore.intelligence.*`)

| Setting | Default | Descripción |
|---------|---------|-------------|
| `editcore.intelligence.enabled` | `false` | Activa la capa SIL |
| `editcore.intelligence.autoGenerateMap` | `false` | Regenerar mapa al abrir workspace |
| `editcore.intelligence.healthIntervalMinutes` | `0` | 0 = solo manual |
| `editcore.intelligence.permissionLevel` | `read` | Máximo nivel sin UI |
| `editcore.intelligence.techMemory.enabled` | `false` | Activa tech memory |

---

## 9. Relación con capacidades existentes

EditCore **ya tiene** piezas reutilizables (no reemplazar):

| Capacidad existente | Uso en SIL |
|---------------------|------------|
| `editcore.selfDiagnostic` | Fuente principal Health Monitor |
| `.editcore/stats.json` | Métricas de rendimiento |
| `observability.jsonl` | Stream de eventos |
| `audit.jsonl` | Historial operativo |
| `run_self_diagnostic` (tool) | Introspección desde agente (read-only) |
| `globalMemory.ts` | Memoria usuario; SIL es memoria **del sistema** |
| `write_adr` / `list_adrs` | ADRs de proyecto; tech-memory es meta del producto |

---

## 10. Aprobación requerida

Antes de escribir código, confirmar:

- [x] **A)** Aprobar plan completo y comenzar Sprint 1 (read-only) — **HECHO v1.0.7**
- [ ] **B)** Aprobar solo documentación (mantener fase 0)
- [ ] **C)** Ajustar alcance (especificar cambios abajo)

**Comentarios / ajustes solicitados:**

```
(Espacio para feedback del usuario)
```

---

## 11. Referencias

- Mapa del sistema (baseline): `docs/EDITCORE_SYSTEM_MAP.md`
- Diagnósticos: `extensions/editcore-claude/src/diagnostics/`
- Telemetría: `extensions/editcore-claude/src/orchestration/orchestrator.ts` → `logPerformanceMetrics`
- Observabilidad: `extensions/editcore-claude/src/platform/observability.ts`
- Workspace bootstrap: `extensions/editcore-claude/src/workspace/workspaceBootstrap.ts`
