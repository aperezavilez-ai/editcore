# EditCore Software Factory

Estado: **agentes reales en el IDE + pipeline de tracking real en producción**.
No es una fábrica que construye software sin intervención humana — es un
sistema que estructura el proceso completo de construcción con agentes IA
especializados y persistencia real del estado.

## 1. Lo que sí existe (real, usable hoy)

**Agentes del IDE** (uso: `@nombre` en el chat):
| Agente | Qué hace |
|---|---|
| `@product-manager` | Convierte una idea en PRODUCT_REQUIREMENTS.md con historias de usuario y criterios de aceptación |
| `@sprint-planner` | Divide los requerimientos en sprints con tareas, agentes asignados y dependencias |
| `@saas-builder` | Genera código real y completo para auth, roles, multi-tenancy, billing Stripe, APIs y dashboards |
| `@test-factory` | Genera unit/integration/e2e/security tests sobre el código real del proyecto |
| `@release-manager` | Checklist de pre-release, versionado semántico, release notes y registro de versiones |
| `@maintenance-agent` | Analiza logs/errores, revisa dependencias, detecta queries lentas, propone mejoras |

**API y base de datos real:**
- `factory_projects` — proyectos con status pipeline (planning → in_progress → testing → deploying → live)
- `factory_tasks` — tareas de sprint con agente asignado, prioridad, estado y campo de aprobación humana
- `factory_releases` — historial inmutable de releases por versión (semver), con canal alpha/beta/production
- `factory_components` — biblioteca de componentes reutilizables entre proyectos
- `/api/v1/factory/projects` (GET/POST/PATCH)
- `/api/v1/factory/tasks` (GET/POST/PATCH)
- `/api/v1/factory/releases` (GET/POST)
- `web/factory.html` — dashboard de producción con proyectos, tareas y releases

## 2. Lo que NO existe todavía (honesto, no inventado)

- **Construcción autónoma real**: los agentes guían, generan código y proponen — pero el código sigue siendo escrito por el humano + Claude en el IDE. No hay un proceso que abra PRs, commitee código y despliegue solo.
- **Generador de aplicaciones móviles** (Fase 12): no existe. React Native/Flutter requieren entornos de build específicos (Xcode, Android SDK) que no están en el entorno del proyecto.
- **Desarrollo paralelo real entre agentes** (Fase 4): los agentes del chat trabajan secuencialmente dentro de una sesión de EditCore IDE, no en paralelo verdadero.
- **CI/CD automático** (Fase 8): Vercel ya despliega automáticamente desde `main`, pero no hay un pipeline configurado de CI (tests automáticos antes del merge). Eso requeriría GitHub Actions configurado en el repo.
