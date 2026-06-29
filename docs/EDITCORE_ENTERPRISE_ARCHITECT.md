# EditCore Enterprise Architect

Estado: **agentes reales disponibles en el IDE, biblioteca de patrones real
en producción**. No es un sistema autónomo que diseñe sin intervención — es
un conjunto de roles especializados del chat IA del IDE que guían al usuario
a través de un proceso estructurado de análisis y diseño.

## 1. Lo que sí existe (real, usable hoy)

- **`@enterprise-architect`** — Rol activo en el chat del IDE: analiza necesidades de negocio, diseña arquitecturas por capas (Frontend → API → Datos → Infra → Seguridad), genera roadmaps por fases y diseña equipos de agentes IA. Produce documentos `BUSINESS_REQUIREMENTS_DOCUMENT.md`, `SOLUTION_ARCHITECTURE.md`, `IMPLEMENTATION_ROADMAP.md` como salida del chat.
- **`@ai-architect`** — Diseña la capa de IA: selección de modelos con justificación, arquitectura de agentes, memoria (contexto vs. sesión vs. RAG), vector stores. Estima costo de inferencia y alerta sobre riesgos.
- **`@cost-analyst`** — Estima costos reales por categoría (infra, servicios, IA, desarrollo, mantenimiento), compara opciones con trade-offs. Genera `PROJECT_COST_ESTIMATE.md`.
- **`@risk-analyst`** — Análisis de riesgos por categoría (seguridad, escalabilidad, dependencias, complejidad), con probabilidad, impacto y mitigación concreta. Genera `PROJECT_RISK_REPORT.md`.
- **`@enterprise-consultant`** — Modo consultor estratégico: no solo responde cómo construir, sino si vale la pena construirlo, qué supuesto validar primero y cuál es la opción más simple real.
- **`/api/v1/architect/patterns`** (GET/POST) — Biblioteca de patrones de arquitectura accesible vía API (pública para leer, requiere sesión para contribuir). Filtrable por categoría (saas, enterprise, ai, data, security, devops...).
- **`/api/v1/architect/projects`** (GET/POST) — Guarda proyectos de arquitectura generados (BRD, solution architecture, AI architecture, roadmap, costos, riesgos) asociados a la cuenta del usuario.
- Tabla `architecture_patterns` y `architecture_projects` (Supabase, `supabase/migrations/0007_architecture_library.sql`).

## 2. Cómo usar los agentes hoy (pasos reales)

1. Abre EditCore IDE y un workspace.
2. En el chat del IDE, escribe: `@enterprise-architect Tengo un negocio de [X]. Necesito construir [Y]. Usuarios estimados: [Z].`
3. El agente te hará preguntas hasta tener suficiente contexto, luego generará el diseño estructurado.
4. Para análisis específicos: `@cost-analyst estima el costo de la arquitectura anterior para 10.000 usuarios/mes`.
5. Para riesgos: `@risk-analyst revisa el diseño propuesto e identifica los 3 riesgos más críticos`.
6. Para decisiones estratégicas: `@enterprise-consultant ¿debería construir esto internamente o usar [X] como servicio?`

## 3. Lo que NO existe todavía (honesto, no inventado)

- **Diagramas visuales**: los agentes describen arquitecturas en texto/Markdown/ASCII — no generan imágenes, Mermaid diagrams ni exports a draw.io (eso requeriría integración con herramientas de diagramación).
- **Validación automática de diseño antes de construir** (Fase 13): el checklist de validación está en el system prompt del agente — lo hace el modelo de IA al responder, no hay un proceso automatizado separado que ejecute las revisiones.
- **Integración con los sistemas existentes de EditCore** (Fase 14: AI Orchestrator, AI Factory, etc.): los agentes Enterprise Architect viven en el chat del IDE y no se comunican automáticamente con los módulos del servidor (evolution_proposals, agent_definitions, etc.). Esa integración sería el próximo paso natural.
- **Wireframes y prototipos funcionales** (Fase 7): los agentes pueden generar código HTML/CSS de prototipos si se les pide, pero no hay un "Prototype Builder" automático que genere un MVP listo sin que el usuario guíe la conversación.
