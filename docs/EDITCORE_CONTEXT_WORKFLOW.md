# EDITCORE Context Workflow

## Antes de cada tarea (Agent / Ask / ADE)

1. Workspace snapshot
2. PROJECT_KNOWLEDGE_MAP
3. Memoria proyecto + técnica
4. Conversaciones relevantes
5. Arquitectura + cambios recientes
6. RAG recuperado
7. Preferencias aprendidas
8. Tarea del usuario

## Integración

- `agentContext.ts` → `contextAssembler`
- `aiRouter.ts` → RAG fallback si Qdrant vacío
- `autonomous/taskEngine.ts` → contexto automático

