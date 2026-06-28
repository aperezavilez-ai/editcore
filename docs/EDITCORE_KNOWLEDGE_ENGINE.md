# EDITCORE Knowledge Engine

## Visión

Sistema de conocimiento interno que comprende proyectos completos antes de cualquier cambio.

## Módulos

```
knowledge/projectKnowledgeEngine.ts  → PROJECT_KNOWLEDGE_MAP.json
knowledge/knowledgeIndexer.ts        → indexación unificada
knowledge/ragPipeline.ts             → RAG unificado (local + memoria + Qdrant)
knowledge/semanticAnalyzer.ts        → deuda, duplicación, patrones
knowledge/knowledgeViewProvider.ts   → Knowledge Center UI
memory/contextAssembler.ts           → contexto pre-tarea unificado
```

## Comandos

- `editcore.knowledge.reindex`
- `editcore.knowledge.buildMap`
- `editcore.knowledge.search`
- `editcore.knowledge.openCenter`
- `editcore.knowledge.purge`
- `editcore.knowledge.generateDocs`

