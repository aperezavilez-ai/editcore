# EDITCORE Task System

## EDITCORE TASK ENGINE

1. Recibe objetivo del usuario
2. Analiza requerimientos (PROJECT_UNDERSTANDING)
3. Convierte en tareas técnicas (AUTONOMOUS_PLAN)
4. Asigna agentes (via AOS pipeline)
5. Ejecuta implementación
6. Supervisa con Self Debug Loop
7. Genera TASK_COMPLETION_REPORT

## Artefactos

| Archivo | Ubicación |
|---------|-----------|
| PROJECT_UNDERSTANDING.md | .editcore/docs/ |
| AUTONOMOUS_PLAN.md | .editcore/autonomous/ |
| TASK_COMPLETION_REPORT.md | .editcore/reports/ |
| NEXT_IMPROVEMENT_PLAN.md | .editcore/docs/ |
| execution-log.jsonl | .editcore/autonomous/ |

## Niveles de autonomía

Integrado con `editcore.autonomy.level` (1–5).

