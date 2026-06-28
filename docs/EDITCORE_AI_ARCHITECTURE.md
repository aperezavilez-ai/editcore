# EDITCORE AI Architecture

## Capas

```
Usuario (Chat / Comandos)
        ↓
EDITCORE AI ORCHESTRATOR (aos/aiOrchestrator.ts)
        ↓
Model Router (aos/modelRouter.ts) → Claude | OpenAI
        ↓
Agent Registry (aos/agentRegistry.ts) → 8 agentes
        ↓
Agent Loop (agent/agentLoop.ts | openaiAgentLoop.ts)
        ↓
Tools (agent/tools.ts) + MCP
        ↓
Memory (memory/memoryManager.ts) + RAG
        ↓
Evolution Manager (aos/evolutionManager.ts)
```

## Módulos legacy integrados (sin duplicar)

- `orchestration/orchestrator.ts` — middleware RAG + select_model
- `evolution/` — ciclos, reportes, fases
- `autonomy/` — niveles 1–5, cola de tareas

