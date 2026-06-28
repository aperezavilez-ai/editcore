# EDITCORE Memory System (Prompt 5)

## Capas de memoria

| Capa | Archivo / store |
|------|-----------------|
| Proyecto | .editcore/memory.md, rules.md |
| Técnica | .editcore/tech-memory/ |
| Conversación | .editcore/knowledge/conversations/ |
| Arquitectura | .editcore/knowledge/architecture-memory.json |
| Cambios | .editcore/knowledge/changes.jsonl |
| Preferencias | .editcore/knowledge/preferences.json |
| Global | globalStorage/global-memory.json |
| Auditoría | .editcore/knowledge/audit.jsonl |

## API

- `memoryManager.ts` — fachada
- `contextAssembler.ts` — ensamblaje pre-tarea

