# EditCore — Startup Builder Agent

## Estado actual

El Startup Builder genera el esqueleto completo de una startup interna con simulacion financiera automatica. El registro y la simulacion son reales; la generacion automatica de codigo o arquitectura no existe aun.

## Que genera el Startup Builder

Al hacer POST /api/v1/lab/startups con nombre, concepto, mercado y modelo de negocio, el sistema crea:

1. **Registro estructurado** con todos los campos del concepto
2. **Simulacion automatica** de 2 anos con rangos conservador/optimista:

```json
{
  "year1": {
    "users_low": 100,
    "users_high": 1000,
    "mrr_low_usd": 500,
    "mrr_high_usd": 10000,
    "burn_rate_usd": 5000
  },
  "year2": {
    "users_low": 1000,
    "users_high": 10000,
    "mrr_low_usd": 5000,
    "mrr_high_usd": 100000,
    "burn_rate_usd": 15000
  },
  "assumptions": [...]
}
```

## Ciclo de vida de una startup interna

```
concept -> validating -> building -> launched
                     -> pivoted
                     -> closed
```

## Campos del MVP Plan

El campo `mvp_plan` es un array JSON de pasos:
```json
[
  { "phase": 1, "name": "Core feature", "duration_weeks": 4, "deliverable": "..." },
  { "phase": 2, "name": "Beta users", "duration_weeks": 2, "deliverable": "..." }
]
```

## Lo que NO existe aun

- Simulacion financiera avanzada basada en datos reales del mercado
- Generacion automatica de arquitectura tecnica recomendada
- Conexion directa con Software Factory para iniciar desarrollo
- Pitch deck automatico
