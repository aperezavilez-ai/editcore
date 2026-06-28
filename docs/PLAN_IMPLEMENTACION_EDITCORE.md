# PLAN_IMPLEMENTACION_EDITCORE

_Evolution Execution System v1.0.9 — plan técnico en repo_

**Estado:** ✅ Implementación completa en código  
**Última actualización:** 2026-06-28

## Regla principal

NO cambios masivos sin plan. Antes de modificar código:

1. Analizar impacto (`analyze_impact`, `run_autonomy_cycle`)
2. Actualizar este plan (`editcore.evolution.generatePlan`)
3. Listar archivos y dependencias
4. Definir pruebas (`npm test`, `editcore.evolution.cycle`)
5. Estrategia de reversión (`git_branch`, `REPORTE_CAMBIOS`)

## Mejoras prioritarias

Ejecutar `editcore.autonomy.diagnose` para cola viva desde hallazgos reales.

## Fases del roadmap (10/10 implementadas)

| Fase | Nombre | Módulo principal | Estado |
|------|--------|------------------|--------|
| 1 | Cerebro IA | `orchestration/agentPipeline.ts` | ✅ |
| 2 | Memoria | `memory/memoryManager.ts` | ✅ |
| 3 | Herramientas | `agent/tools.ts` (+ `git_branch`) | ✅ |
| 4 | Multiagente | `agent/multiAgentOrchestrator.ts` | ✅ |
| 5 | QA/CI | `evolution/qaChecklistGenerator.ts` | ✅ |
| 6 | Automejora | `autonomy/autonomyEngine.ts` | ✅ |
| 7 | Git seguro | `evolution/gitSafeFlow.ts` | ✅ |
| 8 | Reportes | `evolution/changeReportGenerator.ts` | ✅ |
| 9 | Prompts evolutivos | `evolution/evolutionPromptGenerator.ts` | ✅ |
| 10 | Model routing | `agent/openaiAgentLoop.ts` | ✅ |

## Niveles de autonomía (1–5)

| Nivel | Capacidad | Setting |
|-------|-----------|---------|
| 1 | Analizar y recomendar | `editcore.autonomy.level: 1` |
| 2 | Crear planes | default |
| 3 | Aplicar cambios aprobados + rama git | |
| 4 | Ejecutar tareas con pruebas | |
| 5 | Ciclos continuos (`continuousIntervalMinutes`) | |

Comando: `editcore.autonomy.setLevel`

## Comandos de ejecución

| Comando | Acción |
|---------|--------|
| `editcore.evolution.generatePlan` | Regenera este archivo |
| `editcore.evolution.runPhase` | Una fase (1–10) con QA + reportes |
| `editcore.evolution.cycle` | Ciclo completo |
| `editcore.autonomy.diagnose` | Diagnóstico + cola |
| `editcore.autonomy.execute` | Ejecutar tarea (nivel ≥4) |

## Artefactos generados en workspace

- `.editcore/docs/PLAN_IMPLEMENTACION_EDITCORE.md`
- `.editcore/docs/REPORTE_CAMBIOS_EDITCORE.md`
- `.editcore/docs/SIGUIENTE_PROMPT_EVOLUCION_EDITCORE.md`
- `.editcore/reports/QA_CHECKLIST.md`
- `.editcore/autonomy/queue.json`

En repo EditCore dev también se copian a `docs/`.

## Pruebas

```bash
cd extensions/editcore-claude
npm run compile
node --test test/*.test.js
```

## Reversión

1. Rama `editcore/evolution-YYYYMMDD` antes de escrituras (nivel ≥3)
2. `git diff` / `REPORTE_CAMBIOS`
3. `git reset --hard` solo con aprobación explícita
