# EditCore — AI Factory: estado real

_Última actualización: 2026-06-29. Mismo criterio que `EDITCORE_INFRASTRUCTURE_AUDIT.md`:
solo se describe lo que existe y se puede verificar en este repositorio. Donde algo
no existe, se dice explícitamente "no existe" en vez de describirlo como si fuera real._

## 1. Qué pidió el prompt original

Un "AI Factory" de 15 fases: generador de apps desde una idea, analista de requisitos,
arquitecto, diseñador de UI, full-stack builder, fábrica de agentes personalizables,
constructor de automatizaciones, plantillas inteligentes, fábrica de documentación,
generador de tests, agente de deployment, fábrica de productos con cobros, base de
conocimiento, control de calidad y una UI de "describe tu idea".

## 2. Qué existe hoy y cómo se conecta

| Fase pedida | Estado real | Dónde está el código |
|---|---|---|
| App Generator / Architecture Builder | **Real.** Pipeline secuencial de 4 roles (Arquitecto → Programador → QA → DevOps) + paso final de documentación, todos con llamadas reales a la API de Claude y a las tools del agente (`write_file`, `run_command`, etc.) | `agent/multiAgentOrchestrator.ts` (`runMultiAgentPipeline`) |
| "Describe tu idea" UI | **Real, recién conectado en esta sesión.** Nuevo comando `editcore.generateFromIdea` (`EditCore: Generar proyecto desde una idea`): abre un input box, pide confirmación para activar el pipeline multi-agente (está desactivado por defecto por costo/tiempo) y dispara el chat con la idea | `verticals/verticalCommands.ts` (`generateFromIdea`), registrado en `extension.ts` |
| Full Stack Builder | **Real.** Es el paso "Programador" del pipeline, con las mismas tools de escritura de archivos y ejecución de comandos que ya pasan por aprobación manual del usuario | `agent/multiAgentOrchestrator.ts`, `agent/tools.ts` |
| QA Control | **Parcial.** El paso "QA" del pipeline es un rol con prompt especializado, no un analizador de cobertura. Existe además un validador post-cambio real opcional (`postChangeValidator.ts`), desactivado por defecto | `agent/multiAgentOrchestrator.ts`, `platform/postChangeValidator.ts` |
| Documentation Factory | **Parcial.** El pipeline genera un resumen/README al final con una llamada real a Claude. No genera documentación técnica estructurada (OpenAPI, diagramas, etc.) | `agent/multiAgentOrchestrator.ts` (paso "Documentador") |
| Smart Templates | **Real pero limitado.** Dos plantillas empaquetadas (`saas-starter`, `gps-platform`) que son scaffolds estáticos: `README.md`, `docker-compose.yml`, `package.json`, `.env.example`. **No contienen código de aplicación real** — el código lo genera el agente después, vía chat | `verticals/scaffoldService.ts`, `verticals/verticalCommands.ts`, `marketplace/verticals/*` |
| Knowledge Base | **Parcial, local y por proyecto.** RAG local indexa el workspace abierto (`rag/`); no hay base de conocimiento compartida entre proyectos ni entre usuarios | `rag/chunkIndex.ts` y relacionados |
| Requirements Analyst | **No existe como artefacto persistente.** El rol "architect" puede analizar requisitos dentro de una conversación, pero no hay un formulario/flujo dedicado que guarde requisitos estructurados en un documento versionado | — |
| Test Generator | **No existe como generador estructurado.** El rol "QA" puede escribir tests si se le pide en el chat, pero no hay un comando dedicado que genere una suite de tests con cobertura objetivo | — |
| Deployment Agent | **Existe un comando real pero genérico**, no un "agente" con lógica propia de deployment: `editcore.deployAutonomous` ejecuta test+build+deploy a Vercel vía script, sin razonamiento de IA involucrado | `ops/warRoom.ts` (`runAutonomousDeploy`) |

## 3. Qué NO existe (y por qué no se fabricó)

- **UI Design Agent**: no hay ningún componente que genere mockups, wireframes o diseños visuales. No existe ningún esbozo de esto en el código.
- **Agent Factory real (fase 6)**: los "roles" del agente (`@architect`, `@gps`, `@saas`, etc.) son un diccionario fijo de 9 personas hardcodeadas en `agents/roles.ts`. Un usuario **no puede** crear, persistir ni editar un agente propio (nombre, objetivo, modelo, tools, memoria, permisos) desde la UI. Esto requeriría una capa de configuración nueva (ej. `.editcore/agents.json` + UI de edición) que no se construyó en esta sesión porque es una pieza nueva y no trivial — se puede evaluar a futuro como tarea separada.
- **Automation Builder (fase 7)**: no existe ningún sistema de triggers (evento → acción) ni flujo visual. Una extensión de VS Code tiene limitaciones reales aquí: no hay proceso en background persistente fuera de la sesión del editor, ni forma de recibir webhooks entrantes sin un servidor — construir esto "de verdad" implicaría decidir si se necesita un backend, lo cual está fuera del alcance de "aplicar lo que ya existe".
- **Product Factory con cobros (fase 12)**: no existe ningún código de facturación, pasarela de pago ni panel de administración generado. Fabricar esto sin una decisión de producto real (qué pasarela, qué modelo de cobro, quién opera la cuenta) habría significado inventar funcionalidad que no se puede verificar ni usar — se excluyó deliberadamente.

## 4. Cómo usarlo hoy

1. Comando `EditCore: Generar proyecto desde una idea` (`editcore.generateFromIdea`).
2. Describir la idea en una línea.
3. Confirmar la activación del pipeline multi-agente (queda activado en la configuración global hasta que el usuario lo desactive).
4. El chat ejecuta el pipeline real: cada escritura de archivo y cada comando de terminal sigue pasando por la aprobación manual ya existente (`showDiffAndConfirm`, `requestCommandApproval`) — nada se ejecuta sin confirmación.

## 5. Qué falta para que las fases 4/6/7/12 sean reales

Igual que en la auditoría de infraestructura: estas cuatro fases no son "casi reales con
un cable suelto", son piezas nuevas que requieren decisiones de producto (¿se necesita
un backend para automatizaciones y pagos?, ¿cuánto control le damos al usuario para
definir agentes propios?). Si se quiere avanzar, conviene discutirlas una por una en
vez de construir las cuatro a la vez.
