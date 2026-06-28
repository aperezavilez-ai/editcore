# PLAN_DE_TRABAJO

_EditCore Agent Operating System — plan antes de ejecutar_

**Generado:** 2026-06-26

## Objetivo

EDITCORE Agent Operating System (Prompt 3) — orquestador central, 8 agentes especializados, memoria inteligente, herramientas reales, planificación, revisión automática, Git seguro, niveles de autonomía 1–5, selección de modelo Claude/OpenAI, Evolution Manager y seguridad IA.

## Análisis

Implementación completada en **v1.1.0**. Módulos en `extensions/editcore-claude/src/aos/`. Documentación en `docs/EDITCORE_*.md`. Integración con autonomía (`autonomy/`), evolución (`evolution/`) y memoria (`memory/memoryManager.ts`) sin duplicar orchestrators legacy.

## Archivos afectados

- `extensions/editcore-claude/src/aos/aiOrchestrator.ts`
- `extensions/editcore-claude/src/aos/agentRegistry.ts`
- `extensions/editcore-claude/src/aos/modelRouter.ts`
- `extensions/editcore-claude/src/aos/securityGuard.ts`
- `extensions/editcore-claude/src/aos/evolutionManager.ts`
- `extensions/editcore-claude/src/aos/workPlanGenerator.ts`
- `extensions/editcore-claude/src/aos/docGenerator.ts`
- `extensions/editcore-claude/src/memory/memoryManager.ts`
- `extensions/editcore-claude/src/orchestration/agentPipeline.ts`

## Pasos

1. Architect: diseño y análisis de impacto
2. AI Orchestrator recibe tarea y analiza intención
3. Model Router selecciona Claude u OpenAI por agente
4. Agent Registry ejecuta pipeline (Architect → Developer → Review → Debug → QA → Security → Docs → Prompts)
5. Memory Manager persiste decisiones, cambios y conversaciones
6. Security Guard valida comandos y acciones críticas
7. Evolution Manager genera recomendaciones y roadmap
8. Documentation Agent actualiza docs en `docs/` y `.editcore/docs/`

## Riesgos

- Duplicación con orchestrator legacy — mitigado vía `agentPipeline` reexportando AOS
- Ejecución autónoma sin aprobación en nivel de autonomía < 3
- Comandos destructivos — mitigado por Security Guard en `execRunCommand`

## Pruebas necesarias

- `npm run compile` en `extensions/editcore-claude`
- `node --test test/*.test.js`
- Comando `editcore.aos.run` en workspace EDITCORE
- Comando `editcore.aos.generateDocs` para regenerar documentación

## Estrategia de reversión

- Crear rama `editcore/work-*` antes de cambios (`editcore.evolution.gitBranchBeforeChanges`)
- `git stash` / `git reset` según `docs/REPORTE_CAMBIOS_EDITCORE.md`

---

_Aprobar este plan antes de ejecutar con `editcore.aos.run` (nivel autonomía ≥3)._
