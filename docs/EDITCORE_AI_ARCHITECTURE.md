# EditCore AI Architecture

Estado: **agente real de diseño IA disponible en el IDE**. El agente
`@ai-architect` en el chat del IDE ayuda a diseñar la capa de inteligencia
artificial de cualquier proyecto, con selección de modelos justificada,
arquitectura de agentes, memoria y RAG.

## 1. Guideline de selección de modelos (real, no inventado)

| Tarea | Modelo recomendado | Razón |
|---|---|---|
| Razonamiento complejo, revisión de arquitectura, análisis largo | Claude Sonnet/Opus | Ventana de contexto amplia, mejor razonamiento encadenado |
| Generación de código rápida, automatización | Claude Haiku, GPT-4o mini, Gemini Flash | Menor latencia, menor costo por token |
| Construcción intensiva, contexto moderado | GPT-4o, Claude Sonnet | Balance costo/capacidad |
| Embeddings y RAG | text-embedding-3-small (OpenAI) o Gemini text-embedding | Precio/dimensión favorable |
| Privacidad total de datos (sin salida a APIs externas) | Llama 3 / Mistral local | Sin dependencia de proveedor |

*Los precios y capacidades cambian constantemente — verificar siempre el pricing oficial del proveedor antes de comprometerse.*

## 2. Arquitectura de memoria (qué existe en cada capa)

| Tipo de memoria | Dónde vive | Cuándo usarlo |
|---|---|---|
| Contexto en-prompt | Window de la conversación del LLM | Información de la sesión actual, historial reciente |
| Memoria de sesión | Redis, base de datos (ej. Supabase) | Persistir estado entre requests del mismo usuario |
| Memoria a largo plazo | RAG sobre base vectorial (pgvector, Pinecone, Weaviate) | Conocimiento de dominio, documentación, historial de proyectos |

## 3. Lo que NO existe todavía en EditCore

- **RAG sobre base de datos de EditCore**: no hay ningún pipeline de embeddings sobre los datos del sistema (architecture_patterns, community_posts, evolution_proposals). Los patrones están en Supabase pero no vectorizados.
- **Coordinación automática entre agentes**: los agentes `@enterprise-architect`, `@ai-architect`, `@cost-analyst` y `@risk-analyst` son roles de chat independientes — no se invocan entre sí automáticamente.
- **Evaluación automática de calidad de respuesta**: no hay ningún loop de feedback que mida si el output del agente fue bueno y ajuste el prompt.

## 4. Próximos pasos honestos

1. Vectorizar `architecture_patterns` con embeddings y agregar búsqueda semántica a `/api/v1/architect/patterns` — esto convertiría la biblioteca en un RAG real.
2. Orquestador que, dado un problema de negocio, invoque `@enterprise-architect` → `@ai-architect` → `@cost-analyst` → `@risk-analyst` en secuencia automática.
