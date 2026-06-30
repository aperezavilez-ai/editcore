# EditCore Project Memory (Prompt 21 — Fase 10)

## Decisión de diseño: reutiliza el Knowledge Graph existente

Igual que con los agentes de desarrollo, no se creó una tabla nueva de "memoria de proyecto". El Knowledge Graph (`knowledge_nodes` + `knowledge_edges`, Prompt 16, expuesto en `api/v1/network/knowledge.ts`) ya está diseñado para guardar exactamente este tipo de información: nodos tipados con `node_type`, `tags`, `confidence` y `source_agent`.

## Cómo registrar memoria del proyecto (real, vía API existente)

`POST /api/v1/network/knowledge` con `node_type` en uno de estos valores convencionales (no son un enum forzado en la base de datos, son una convención documentada aquí):

| `node_type` sugerido | Para qué |
|---|---|
| `decision` | Decisiones técnicas (ej. "no se duplica el model router en Prompt 20") |
| `change` | Cambios realizados (complementa `EDITCORE_CHANGE_LOG.md`, pero consultable/relacionable vía grafo) |
| `problem_solved` | Problemas y su solución (ej. el caso `agen-browser` que no existía → se instaló `playwright`) |
| `architecture` | Piezas de arquitectura documentadas como nodo consultable |
| `learning` | Aprendizajes generales (ej. "los endpoints de métricas siguen siempre el mismo patrón Promise.all") |

Cada nodo puede conectarse a otros vía `POST /api/v1/network/knowledge/edges` (`from_node_id`, `to_node_id`, `relation_type`), permitiendo, por ejemplo, conectar una `decision` con el `change` que la implementó.

## Por qué esto y no archivos markdown sueltos como "memoria"

Los `docs/EDITCORE_*.md` (incluido este) son la memoria **legible por humanos** y versionada en git — siguen siendo la fuente de verdad para auditoría. El Knowledge Graph es la memoria **consultable por agentes/programas** (vía API, filtrable por tag/tipo). Ambas existen y se complementan; no se fusionan porque tienen audiencias distintas.

## Lo que NO existe aún

- No hay un proceso automático que, al cerrar un prompt, inserte automáticamente nodos de `decision`/`change` en el Knowledge Graph — hoy esto sería un paso manual del usuario o de un agente con sesión autenticada.
- No hay búsqueda semántica (embeddings) sobre `knowledge_nodes.content` — solo filtros exactos por `type`/`tag` (`GET /api/v1/network/knowledge?type=...&tag=...`).
