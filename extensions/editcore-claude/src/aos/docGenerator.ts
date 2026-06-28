/**
 * Genera documentación de arquitectura AOS en docs/ (Prompt 3).
 */
import * as fs from "fs";
import * as path from "path";

function docsPath(root: string, filename: string): string {
  const repoDocs = path.join(root, "docs", filename);
  return repoDocs;
}

export async function writeAosDocumentation(root: string): Promise<string[]> {
  const written: string[] = [];
  await fs.promises.mkdir(path.join(root, "docs"), { recursive: true });

  const files: Record<string, string> = {
    "EDITCORE_AI_ARCHITECTURE.md": buildAiArchitectureDoc(),
    "EDITCORE_AGENT_SYSTEM.md": buildAgentSystemDoc(),
    "EDITCORE_MEMORY_SYSTEM.md": buildMemorySystemDoc(),
    "EDITCORE_AUTOMATION_FLOW.md": buildAutomationFlowDoc(),
    "EDITCORE_MODEL_ROUTING.md": buildModelRoutingDoc(),
  };

  for (const [name, content] of Object.entries(files)) {
    const p = docsPath(root, name);
    await fs.promises.writeFile(p, content + "\n", "utf8");
    written.push(p);

    const editcoreDocs = path.join(root, ".editcore", "docs", name);
    await fs.promises.mkdir(path.dirname(editcoreDocs), { recursive: true });
    await fs.promises.writeFile(editcoreDocs, content + "\n", "utf8");
    written.push(editcoreDocs);
  }

  return written;
}

function buildAiArchitectureDoc(): string {
  return `# EDITCORE AI Architecture

## Capas

\`\`\`
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
\`\`\`

## Módulos legacy integrados (sin duplicar)

- \`orchestration/orchestrator.ts\` — middleware RAG + select_model
- \`evolution/\` — ciclos, reportes, fases
- \`autonomy/\` — niveles 1–5, cola de tareas
`;
}

function buildAgentSystemDoc(): string {
  return `# EDITCORE Agent System

| Agente | Rol ID | Modelo preferido |
|--------|--------|------------------|
| Architect | architect | Claude Sonnet |
| Developer | fullstack | OpenAI GPT-4o |
| Code Review | reviewer | Claude Sonnet |
| Debug | debug | Claude Sonnet |
| QA | qa | Claude Haiku |
| Security | security | Claude Sonnet |
| Documentation | documenter | OpenAI GPT-4o |
| Prompt Engineering | prompt_engineer | Claude Haiku |

## Pipeline Fase 6 (revisión automática)

Developer → Code Review → Debug → QA → Security → Documentation → Prompt Engineer

## Comandos

- \`editcore.aos.run\` — orquestador completo
- \`editcore.aos.generateWorkPlan\` — PLAN_DE_TRABAJO.md
- \`editcore.aos.generateDocs\` — esta documentación
`;
}

function buildMemorySystemDoc(): string {
  return `# EDITCORE Memory System

## Stores unificados (memoryManager.ts)

| Store | Ubicación | Contenido |
|-------|-----------|-----------|
| Project | .editcore/memory.md, rules.md | Reglas y notas |
| Tech | .editcore/tech-memory/ | Decisiones, ciclos |
| Global | globalStorage/global-memory.json | Cross-proyecto |
| Traces | .editcore/memory/agent-traces.jsonl | Acciones agentes |
| RAG | .editcore/rag/ | Chunks semánticos |

## RAG / Embeddings

- \`rag/chunkIndex.ts\` — índice local
- \`rag/voyageService.ts\` — embeddings Voyage (opcional)
- \`orchestration/orchestrator.ts\` — Qdrant vectorial (opcional)
`;
}

function buildAutomationFlowDoc(): string {
  return `# EDITCORE Automation Flow

## Flujo estándar

1. Usuario solicita tarea
2. AI Orchestrator detecta intent
3. Genera PLAN_DE_TRABAJO.md
4. Crea rama git (nivel ≥3)
5. Ejecuta agentes en pipeline
6. Post-change validation (nivel ≥4)
7. REPORTE_CAMBIOS + QA_CHECKLIST
8. Evolution Manager (nivel 5 / intent evolve)

## Niveles autonomía

| Nivel | Nombre |
|-------|--------|
| 1 | Asistente |
| 2 | Analista |
| 3 | Desarrollador con aprobación |
| 4 | Implementación autónoma controlada |
| 5 | Optimización continua |
`;
}

function buildModelRoutingDoc(): string {
  return `# EDITCORE Model Routing

## Reglas (aos/modelRouter.ts)

**Claude:** architect, reviewer, debug, qa, security, prompt_engineer

**OpenAI:** fullstack (Developer), documenter

## Override

\`editcore.aos.modelOverride\`: auto | anthropic | openai

## Fallback

Si OpenAI no disponible para Developer → Claude con tools.
`;
}
