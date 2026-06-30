# EditCore Development Pipeline

Estado: **pipeline documentado y con tracking real; ejecución asistida por
agentes IA, no totalmente autónoma**.

## 1. El pipeline completo (de idea a producción)

```
IDEA DEL USUARIO
      ↓
@product-manager → PRODUCT_REQUIREMENTS.md
      ↓
@enterprise-architect (Prompt 13) → SOLUTION_ARCHITECTURE.md
      ↓
@sprint-planner → Plan de sprints + tareas en factory_tasks
      ↓
[SPRINT 1...N]
  @saas-builder / @fullstack / @devops (por tarea)
  → Código generado en IDE → commit a rama → revisión → merge
      ↓
@test-factory → Tests sobre el código real
      ↓
@security (revisión de seguridad)
      ↓
@release-manager → Checklist pre-release → release notes → POST /api/v1/factory/releases
      ↓
Merge a main → deploy automático Vercel
      ↓
@maintenance-agent (monitoreo continuo de errores y logs)
```

## 2. Qué parte es autónoma y qué requiere humano

| Etapa | Autónoma (agente IA) | Requiere humano |
|---|---|---|
| Análisis de requerimientos | Preguntas + estructura | Responder las preguntas, validar el PRD |
| Diseño de arquitectura | Propone stack y capas | Aprobar decisiones críticas |
| Planificación de sprints | Genera plan y tareas | Revisar y ajustar prioridades |
| Generación de código | Genera código en IDE | Revisar, ajustar, commitear |
| Tests | Genera tests | Ejecutarlos y revisar resultados |
| Deploy | Vercel auto-deploya desde main | Aprobar merge a main |
| Releases | Propone versión y notas | Registrar y confirmar el release |
| Mantenimiento | Analiza logs y propone fixes | Aprobar e implementar fixes |

## 3. Lo que NO existe todavía

- GitHub Actions CI: los tests no se ejecutan automáticamente en cada PR — eso requiere configurar un `.github/workflows/ci.yml`, que no está en el repo todavía.
- Notificaciones de errores en producción: no hay integración con Sentry, Datadog u otro sistema de alertas. Los errores se ven solo en logs de Vercel.
