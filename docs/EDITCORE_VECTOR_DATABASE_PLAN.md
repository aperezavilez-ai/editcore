# EDITCORE Vector Database Plan

## Estado actual

| Backend | Uso |
|---------|-----|
| Local TF-IDF | `.editcore/rag/index.json` — siempre activo |
| Voyage API | Re-rank embeddings opcional |
| Qdrant | `orchestrator.qdrantUrl` — fallback remoto |

## Roadmap

1. **Fase A (actual):** local + Voyage re-rank
2. **Fase B:** sync chunkIndex → Qdrant on reindex
3. **Fase C:** memoria unificada como colección `editcore_memory`
4. **Fase D:** multi-proyecto con namespaces por projectId

## Configuración Qdrant

```json
{
  "editcore.orchestrator.qdrantUrl": "http://127.0.0.1:6333",
  "editcore.orchestrator.qdrantCollection": "editcore_code"
}
```

