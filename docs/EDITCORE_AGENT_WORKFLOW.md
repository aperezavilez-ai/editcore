# EditCore Agent Workflow

Estado: **todos los agentes listados son reales y usables hoy en el IDE**.

## 1. Mapa completo de agentes disponibles en EditCore IDE

| Uso en chat | Agente | Prompt |
|---|---|---|
| `@product-manager` | Product Manager | Convierte ideas en PRD con historias de usuario |
| `@sprint-planner` | Sprint Planner | Genera plan de sprints, tareas y asignaciones |
| `@enterprise-architect` | Enterprise Architect | Analiza negocio y diseña arquitectura completa |
| `@ai-architect` | AI Architect | Diseña capa de IA: modelos, agentes, RAG, memoria |
| `@cost-analyst` | Cost Analyst | Estima costos por capa con trade-offs |
| `@risk-analyst` | Risk Analyst | Tabla de riesgos con probabilidad, impacto y mitigación |
| `@enterprise-consultant` | Enterprise Consultant | Decisiones estratégicas, build vs. buy |
| `@saas-builder` | SaaS Builder | Genera código real: auth, roles, billing, APIs |
| `@test-factory` | Test Factory | Genera unit/integration/e2e/security tests |
| `@release-manager` | Release Manager | Versioning semántico, checklist, release notes |
| `@maintenance-agent` | Maintenance Agent | Analiza errores, logs, dependencias desactualizadas |
| `@architect` | Arquitecto Pro | Diseño de módulos, ADRs, deuda técnica |
| `@fullstack` | Full Stack | Implementación end-to-end (UI, API, datos) |
| `@devops` | DevOps | CI/CD, Docker, deploy, scripts, variables de entorno |
| `@qa` | QA | Bugs, casos borde, regresiones |
| `@security` | Security Expert | OWASP Top 10, hardening, RBAC |
| `@cto` | CTO | Escalabilidad, costos, compliance, roadmap ejecutivo |
| `@founder` | Modo Fundador | MVP, mercado, modelo de negocio, go-to-market |
| `@billing` | Billing / Pagos | Stripe, Mercado Pago, webhooks, suscripciones |
| `@ui-design` | UI Design | Código HTML/CSS/JSX accesible y responsive |
| `@saas` | SaaS Builder (básico) | Auth, roles, multi-tenant, billing, deploy |
| `@gps` | GPS / Flotas | Telemetría, Teltonika, mapas, alertas de flota |

## 2. Cómo agregar un agente personalizado

Crea `.editcore/agents.json` en tu workspace:
```json
[
  {
    "id": "mi-agente",
    "label": "Mi Agente Especializado",
    "systemPrompt": "Rol: ...",
    "allowedTools": ["read_file", "write_file"]
  }
]
```
Luego usa `@mi-agente` en el chat del IDE.

## 3. Coordinación entre agentes (hoy manual)

Los agentes no se invocan entre sí automáticamente. El flujo típico:
1. Usuario usa `@product-manager` → obtiene PRD.
2. Usuario copia el PRD y lo pasa a `@enterprise-architect`.
3. Usuario copia la arquitectura y la pasa a `@sprint-planner`.
4. Y así sucesivamente.

La coordinación automática entre agentes (que uno invoque al siguiente
con el output del anterior) requeriría un orquestador que hoy no existe.
