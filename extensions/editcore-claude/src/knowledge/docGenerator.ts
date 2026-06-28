/**
 * Documentación Prompt 5.
 */
import * as fs from "fs";
import * as path from "path";

const DOCS: Array<{ name: string; content: string }> = [
  {
    name: "EDITCORE_KNOWLEDGE_ENGINE.md",
    content: `# EDITCORE Knowledge Engine

## Visión

Sistema de conocimiento interno que comprende proyectos completos antes de cualquier cambio.

## Módulos

\`\`\`
knowledge/projectKnowledgeEngine.ts  → PROJECT_KNOWLEDGE_MAP.json
knowledge/knowledgeIndexer.ts        → indexación unificada
knowledge/ragPipeline.ts             → RAG unificado (local + memoria + Qdrant)
knowledge/semanticAnalyzer.ts        → deuda, duplicación, patrones
knowledge/knowledgeViewProvider.ts   → Knowledge Center UI
memory/contextAssembler.ts           → contexto pre-tarea unificado
\`\`\`

## Comandos

- \`editcore.knowledge.reindex\`
- \`editcore.knowledge.buildMap\`
- \`editcore.knowledge.search\`
- \`editcore.knowledge.openCenter\`
- \`editcore.knowledge.purge\`
- \`editcore.knowledge.generateDocs\`
`,
  },
  {
    name: "EDITCORE_RAG_ARCHITECTURE.md",
    content: `# EDITCORE RAG Architecture

## Flujo unificado

\`\`\`
Pregunta/tarea
    ↓
ragPipeline.retrieveKnowledgeContext
    ↓
1. hybridCodeSearch (keyword + TF-IDF + Voyage)
2. searchMemory (project + tech + global)
3. architectureMemory
4. changeMemory
5. Qdrant fallback (opcional)
    ↓
tokenOptimizer.pruneHits
    ↓
contextAssembler → modelo IA
\`\`\`

## Settings

- \`editcore.knowledge.rag.enabled\`
- \`editcore.knowledge.useQdrantFallback\`
- \`editcore.rag.useEmbeddings\`
`,
  },
  {
    name: "EDITCORE_MEMORY_SYSTEM.md",
    content: `# EDITCORE Memory System (Prompt 5)

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

- \`memoryManager.ts\` — fachada
- \`contextAssembler.ts\` — ensamblaje pre-tarea
`,
  },
  {
    name: "EDITCORE_CONTEXT_WORKFLOW.md",
    content: `# EDITCORE Context Workflow

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

- \`agentContext.ts\` → \`contextAssembler\`
- \`aiRouter.ts\` → RAG fallback si Qdrant vacío
- \`autonomous/taskEngine.ts\` → contexto automático
`,
  },
  {
    name: "EDITCORE_VECTOR_DATABASE_PLAN.md",
    content: `# EDITCORE Vector Database Plan

## Estado actual

| Backend | Uso |
|---------|-----|
| Local TF-IDF | \`.editcore/rag/index.json\` — siempre activo |
| Voyage API | Re-rank embeddings opcional |
| Qdrant | \`orchestrator.qdrantUrl\` — fallback remoto |

## Roadmap

1. **Fase A (actual):** local + Voyage re-rank
2. **Fase B:** sync chunkIndex → Qdrant on reindex
3. **Fase C:** memoria unificada como colección \`editcore_memory\`
4. **Fase D:** multi-proyecto con namespaces por projectId

## Configuración Qdrant

\`\`\`json
{
  "editcore.orchestrator.qdrantUrl": "http://127.0.0.1:6333",
  "editcore.orchestrator.qdrantCollection": "editcore_code"
}
\`\`\`
`,
  },
];

export async function writeKnowledgeDocumentation(root: string): Promise<string[]> {
  const written: string[] = [];
  for (const dir of [path.join(root, ".editcore", "docs"), path.join(root, "docs")]) {
    await fs.promises.mkdir(dir, { recursive: true });
    for (const doc of DOCS) {
      const fp = path.join(dir, doc.name);
      await fs.promises.writeFile(fp, doc.content + "\n", "utf8");
      if (!written.includes(fp)) written.push(fp);
    }
  }
  return written;
}
