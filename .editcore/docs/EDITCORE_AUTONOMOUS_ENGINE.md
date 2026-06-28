# EDITCORE Autonomous Developer Engine

## Visión

Motor de desarrollo autónomo que transforma objetivos humanos en cambios reales de software.

## Módulos

```
Usuario → TASK ENGINE (autonomous/taskEngine.ts)
       → PROJECT_ANALYZER → AUTONOMOUS_PLANNER
       → GIT_MANAGER → AOS / AUTONOMOUS_CODER
       → SELF_DEBUG_LOOP → QUALITY_GATE
       → IMPROVEMENT_GENERATOR
```

## Comandos

- `editcore.autonomous.run` — ciclo completo
- `editcore.autonomous.analyzeProject` — PROJECT_UNDERSTANDING.md
- `editcore.autonomous.generatePlan` — plan sin ejecutar
- `editcore.autonomous.openWorkbench` — historial
- `editcore.autonomous.setMode` — copiloto / autónomo
- `editcore.autonomous.generateDocs` — esta documentación

## Settings

- `editcore.autonomous.enabled`
- `editcore.autonomous.mode` — copilot | autonomous
- `editcore.autonomous.maxDebugCycles` (default 3)
- `editcore.autonomous.useAosPipeline` (default true)
- `editcore.autonomous.autoCommit` (default false)
- `editcore.autonomous.confirmCritical` (default true)

