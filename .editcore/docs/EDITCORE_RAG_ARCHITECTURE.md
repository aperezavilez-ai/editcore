# EDITCORE RAG Architecture

## Flujo unificado

```
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
```

## Settings

- `editcore.knowledge.rag.enabled`
- `editcore.knowledge.useQdrantFallback`
- `editcore.rag.useEmbeddings`

