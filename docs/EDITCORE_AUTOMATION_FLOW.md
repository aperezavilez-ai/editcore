# EDITCORE Automation Flow

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

