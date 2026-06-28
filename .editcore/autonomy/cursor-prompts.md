# EditCore — prompts para Cursor (autonomía real)

_Generado: 2026-06-28T23:18:55.317Z_

Copia cada bloque en Cursor Agent. Son tareas derivadas de **datos reales** del IDE, no simulación.

---

## 1. Autodiagnóstico completo (local)

```markdown
# EditCore — tarea de automejora real

## Ejecutar autodiagnóstico completo y registrar en tech-memory

Estado de salud: degraded. Críticos: 0, warnings: 2.


Archivos relacionados:
- extensions/editcore-claude/src/diagnostics/diagnosticService.ts

## Instrucciones
Ejecuta run_self_diagnostic sin análisis Claude (local). Guarda resumen en .editcore/tech-memory/ si hay permiso.

Reglas: usa solo datos reales del repo; no simules herramientas ni inventes archivos.
```

---

## 2. Cambios sin commit

```markdown
# EditCore — tarea de automejora real

## Cambios sin commit

Hallazgo real (warning): 106 archivo(s) con cambios.


## Instrucciones
 M branding/default-settings.json
 M branding/icons/app-icon-source.svg
 M branding/icons/editcore-icon.svg
 M branding/icons/editcore-logo-512.png
 M branding/icons/editcore-logo-web.png
 M branding/icons/editcore-logo.png

Investiga con herramientas reales y propón un fix mínimo verificable.

Reglas: usa solo datos reales del repo; no simules herramientas ni inventes archivos.
```

---

## 3. Instalador EditCoreUserSetup

```markdown
# EditCore — tarea de automejora real

## Instalador EditCoreUserSetup

Hallazgo real (warning): Instalador más viejo (2026-06-28) que el portable.


## Instrucciones
Regenerá con scripts\build-win-installer.ps1 -SetupOnly

Investiga con herramientas reales y propón un fix mínimo verificable.

Reglas: usa solo datos reales del repo; no simules herramientas ni inventes archivos.
```

---

## 4. .editcore/graph.json

```markdown
# EditCore — tarea de automejora real

## .editcore/graph.json

Hallazgo real (info): No encontrado.


## Instrucciones
Investiga la causa con read_file/search_files y aplica un fix mínimo verificable.

Reglas: usa solo datos reales del repo; no simules herramientas ni inventes archivos.
```

---

## 5. Corregir configuración MCP

```markdown
# EditCore — tarea de automejora real

## Corregir configuración MCP

Hallazgo real (info): Sin servidores en .editcore/mcp.json ni en settings.


Archivos relacionados:
- .editcore/mcp.json
- extensions/editcore-claude/src/mcp/mcpClient.ts

## Instrucciones
Lee .editcore/mcp.json y valida servidores. Corrige JSON inválido o rutas incorrectas. Documenta cambios en tech-memory.

Reglas: usa solo datos reales del repo; no simules herramientas ni inventes archivos.
```

---

## 6. Corregir modelo Claude obsoleto

```markdown
# EditCore — tarea de automejora real

## Corregir modelo Claude obsoleto

Hallazgo real (info): Modelo actual: claude-sonnet-4-6


Archivos relacionados:
- extensions/editcore-claude/src/models.ts
- branding/default-settings.json

## Instrucciones
Busca referencias al modelo retirado, actualiza a claude-sonnet-4-6 (o el default en models.ts) y migra settings del usuario si hace falta.

Reglas: usa solo datos reales del repo; no simules herramientas ni inventes archivos.
```

---

## 7. Embeddings Voyage (opcional)

```markdown
# EditCore — tarea de automejora real

## Embeddings Voyage (opcional)

Hallazgo real (info): Sin Voyage API Key — RAG usa solo keywords locales.


## Instrucciones
Investiga la causa con read_file/search_files y aplica un fix mínimo verificable.

Reglas: usa solo datos reales del repo; no simules herramientas ni inventes archivos.
```

---

## 8. Sesiones de agente

```markdown
# EditCore — tarea de automejora real

## Sesiones de agente

Hallazgo real (info): 2 sesión(es) guardada(s).


## Instrucciones
Investiga la causa con read_file/search_files y aplica un fix mínimo verificable.

Reglas: usa solo datos reales del repo; no simules herramientas ni inventes archivos.
```

