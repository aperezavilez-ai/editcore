# EditCore — Innovation Engine

## Estado actual

El Innovation Engine es real y funcional. Permite registrar ideas estructuradas, validarlas con scores multidimensionales y rastrear su ciclo de vida completo.

## Ciclo de vida de una idea

```
draft -> validating -> validated -> building -> launched
                   -> rejected
```

## Campos de una idea

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| title | texto | Nombre de la idea |
| problem | texto | Problema que resuelve |
| solution | texto | Solucion propuesta |
| market | texto | Mercado objetivo |
| complexity | low/medium/high/very_high | Complejidad tecnica |
| potential | low/medium/high/very_high | Potencial de impacto |
| category | product/feature/tool/service/startup/experiment | Tipo de idea |
| validation_scores | JSON | Scores por dimension (0-100) |

## Validacion automatica

Al hacer PATCH con `validation_scores`, el sistema:
1. Promedia 5 dimensiones: demand, competition, cost, technical_feasibility, commercial_potential
2. Calcula `overall` score
3. Auto-actualiza status: >= 70 = validated, < 40 = rejected, resto = validating

## APIs

- `GET /api/v1/lab/ideas?status=validated` — ideas filtradas por estado
- `POST /api/v1/lab/ideas` — crear idea
- `PATCH /api/v1/lab/ideas` — validar o actualizar idea

## Lo que NO existe aun

- Generacion automatica de ideas por agente IA (el campo `generated_by` existe pero el runner no)
- Conexion directa a factory_projects para convertir idea en proyecto
- Notificaciones cuando una idea es validada
