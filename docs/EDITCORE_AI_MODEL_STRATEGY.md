# EditCore AI Model Strategy System (Prompt 21 — Fase 8)

No se construyó un sistema nuevo: `lib/modelRouter.ts` (Prompt 16) ya implementa exactamente lo que esta fase pide — decidir qué modelo usar, para qué tarea, con costo estimado. Este documento explica su estado real y la brecha respecto a lo pedido (OpenAI + Claude).

## Cómo decide hoy (real)

`routeModel(taskType)` y `routeByComplexity(taskType, complexityScore)` usan una tabla fija (`TASK_ROUTING`) que asigna cada uno de los 11 tipos de tarea a un modelo de un catálogo de 3 niveles:

| Tier | Modelo | Costo estimado / 1K tokens | Uso típico |
|---|---|---|---|
| premium | `claude-opus-4-8` | $0.015 | `architecture`, `security_analysis`, o cualquier tarea con `complexity_score > 7` |
| balanced | `claude-sonnet-4-6` | $0.003 | `code_generation`, `code_review`, `debugging`, `test_generation`, `planning`, `data_analysis` |
| economy | `claude-haiku-4-5-20251001` | $0.00025 | `documentation`, `summarization`, `simple_qa`, o `complexity_score <= 3` |

`estimateCost(modelId, inputTokens, outputTokens)` calcula el costo estimado en centavos para un uso dado.

## Brecha real respecto al Prompt 21

El prompt pide explícitamente gestionar **OpenAI API + Claude API + "otros modelos"**. El catálogo actual (`MODEL_CATALOG`) **solo incluye modelos Anthropic**, aunque el tipo `ModelRecommendation.provider` ya soporta `"openai"` como valor posible — es decir, el código está preparado estructuralmente pero el catálogo no tiene entradas OpenAI cargadas.

**No se agregaron modelos OpenAI en este prompt** porque:
1. Hacerlo sin una decisión real de qué modelos OpenAI usar (y sus precios reales, que cambian) sería inventar datos — viola la regla "quiero que todo sea real".
2. El router, igual que el resto del AI Operating System, **no ejecuta llamadas reales a ningún modelo** (ver `EDITCORE_AI_ECOSYSTEM.md`) — es una capa de recomendación. Agregar un proveedor más a una tabla de recomendaciones sin una integración real que la use tiene valor limitado.

## Resultado esperado vs. real

| Pedido | Estado real |
|---|---|
| Decidir qué modelo usar | ✅ Real, basado en reglas por tipo de tarea y complejidad |
| Para qué tarea | ✅ 11 tipos de tarea cubiertos |
| Costo estimado | ✅ `estimateCost()` real, con tabla de precios fija (no consulta precios en vivo a ninguna API) |
| Resultado esperado | ⚠️ El router devuelve una recomendación; no hay feedback loop que compare el resultado real de usar ese modelo contra la predicción |
| OpenAI API | ❌ No incluido en el catálogo — ver brecha arriba. Queda como tarea P3.1 en `EDITCORE_MASTER_ROADMAP.md`, condicionada a que el usuario decida activamente usar OpenAI y configure su propia clave. |

## Próximo paso real (no implementado aquí)

Cuando el usuario quiera activar llamadas reales a modelos, el camino es: agregar su API key (Anthropic y/o OpenAI) en variables de entorno de Vercel (nunca en el repo), crear `lib/llmClient.ts` que use `routeModel()`/`routeByComplexity()` para elegir el modelo y luego haga la llamada real, y registrar el uso en `ai_model_usage` (tabla ya existente, usada hoy solo para registrar costo simulado/manual). Esto es exactamente la tarea P3.1 del roadmap.
