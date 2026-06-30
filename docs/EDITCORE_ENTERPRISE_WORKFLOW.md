# EditCore — Enterprise Workflow (Prompt 17)

Estado: **modelo operativo empresarial con APIs reales**. Documenta el flujo de OKRs, procesos, clientes, finanzas y reportes ejecutivos del Operating Model.

## 1. Flujo completo de arquitectura empresarial

```
NECESIDAD DE NEGOCIO
       ↓
@enterprise-architect (análisis + diseño)
  → BUSINESS_REQUIREMENTS_DOCUMENT.md
  → SOLUTION_ARCHITECTURE.md
       ↓
@ai-architect (si el proyecto necesita IA)
  → Selección de modelos
  → Arquitectura de agentes y memoria
       ↓
@cost-analyst
  → PROJECT_COST_ESTIMATE.md
       ↓
@risk-analyst
  → PROJECT_RISK_REPORT.md
       ↓
@enterprise-architect (roadmap)
  → IMPLEMENTATION_ROADMAP.md
       ↓
@enterprise-consultant (decisión final)
  → "¿Construir internamente o comprar/delegar?"
  → Validación del supuesto más riesgoso
       ↓
GUARDAR EN EDITCORE
  POST /api/v1/architect/projects
       ↓
DESARROLLAR
  (branches de git, sesiones de EditCore IDE, commits a main)
```

## 2. Reglas del flujo

- **Nunca diseñar sin analizar**: `@enterprise-architect` no produce un diseño sin haber recibido suficiente contexto. Si falta información, pregunta antes de diseñar.
- **Justificar cada decisión técnica**: "Usamos Postgres porque..." no "usamos Postgres". El "porque" es parte del entregable.
- **Priorizar simplicidad sobre completitud**: un MVP funcional entregado es mejor que una arquitectura perfecta en papel.
- **Documentar lo que se rechazó**: tan importante como documentar qué se eligió es documentar qué alternativas se descartaron y por qué.

## 3. Integración con sistemas existentes de EditCore

| Sistema EditCore | Integración actual | Lo que falta |
|---|---|---|
| Evolution Engine (Prompt 12) | El output del `@enterprise-architect` puede registrarse como `evolution_proposal` manualmente | Registro automático |
| Agent Definitions (Prompt 11) | Los agentes diseñados se pueden crear vía `/api/v1/agents` | Creación automática desde el diseño |
| Community (Prompt 11) | Los patrones exitosos se pueden compartir vía `community_posts` | Botón de compartir directo |
| Architecture Library | Guardar proyectos vía `/api/v1/architect/projects` | Funciona hoy |
