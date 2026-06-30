# EditCore Model Router

Estado: **implementado en `lib/modelRouter.ts`**, disponible vía
`POST /api/v1/aios/model-router` y usado internamente por el Task
Reasoning Engine.

## 1. Filosofía

No existe un modelo "mejor para todo". El router selecciona el modelo
óptimo equilibrando tres dimensiones: calidad del resultado, costo por
token y latencia. El objetivo es usar el modelo mínimo suficiente
para cada tarea, reservando el premium para donde el razonamiento
profundo es irreemplazable.

## 2. Catálogo de modelos

| Modelo | Tier | Costo/1k tokens | Contexto | Uso ideal |
|---|---|---|---|---|
| `claude-opus-4-8` | Premium | $0.015 | 200k | Arquitectura, seguridad, razonamiento complejo |
| `claude-sonnet-4-6` | Balanced | $0.003 | 200k | Código, debugging, planificación, tests |
| `claude-haiku-4-5-20251001` | Economy | $0.00025 | 200k | Documentación, resúmenes, Q&A simple |

## 3. Routing por tipo de tarea

| Tipo de tarea | Modelo | Justificación |
|---|---|---|
| `architecture` | claude-opus-4-8 | Visión sistémica y razonamiento profundo |
| `security_analysis` | claude-opus-4-8 | Análisis exhaustivo, sin atajos |
| `code_generation` | claude-sonnet-4-6 | Balance óptimo calidad/costo |
| `code_review` | claude-sonnet-4-6 | Contexto amplio, profundidad suficiente |
| `debugging` | claude-sonnet-4-6 | Razonamiento estructurado |
| `test_generation` | claude-sonnet-4-6 | Calidad media, volumen alto |
| `planning` | claude-sonnet-4-6 | Contexto largo, estructura |
| `data_analysis` | claude-sonnet-4-6 | Precisión sobre economía |
| `documentation` | claude-haiku-4-5-20251001 | Tarea estructurada, alta velocidad |
| `summarization` | claude-haiku-4-5-20251001 | Velocidad y bajo costo |
| `simple_qa` | claude-haiku-4-5-20251001 | Latencia mínima |

## 4. Ajuste por complejidad

Cuando se proporciona `complexity_score` (1-10), el router puede hacer
downgrade o upgrade respecto al modelo base por tipo de tarea:

| Complejidad | Comportamiento |
|---|---|
| 1–3 | Siempre economy (haiku), independiente del tipo |
| 4–7 | Sigue routing por tipo; premium hace downgrade a balanced |
| 8–10 | Siempre premium (opus) para máxima calidad |

## 5. Uso en código

```typescript
import { routeModel, routeByComplexity } from "./lib/modelRouter";

// Por tipo de tarea
const rec = routeModel("architecture");
// rec.model_id = "claude-opus-4-8"

// Por complejidad
const rec2 = routeByComplexity("architecture", 4);
// rec2.model_id = "claude-sonnet-4-6" (downgrade a balanced, complejidad media)
```

## 6. API pública

```
POST /api/v1/aios/model-router
Content-Type: application/json
Authorization: Bearer <token>  (o x-editcore-api-key)

{ "task_type": "code_generation", "complexity_score": 6 }
```
