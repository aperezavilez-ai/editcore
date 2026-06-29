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

## 3. Fases 4/6/7/12 — implementadas con alcance honesto (actualizado)

Estas cuatro fases se dejaron fuera en la primera pasada porque "hacerlas de verdad"
sin inventar nada requería decisiones de alcance. Con el "adelante hazlas" del usuario
se implementó la versión real y verificable de cada una — explícitamente **sin**
fabricar la parte que de verdad no es viable sin un backend propio.

- **UI Design Agent (fase 4) — real, es una persona, no un generador visual.**
  Nuevo rol `@ui-design` en `agents/roles.ts`. Genera código (HTML/CSS/JSX/TSX) siguiendo
  la librería de UI ya usada en el proyecto, no imágenes ni mockups — el propio system
  prompt aclara esa distinción para que el usuario no espere algo que no es.

- **Agent Factory (fase 6) — real, persistido en el workspace.**
  Nuevo comando `EditCore: Crear agente personalizado` (`editcore.createCustomAgent`):
  pide nombre + objetivo y guarda el agente en `.editcore/agents.json`. Se carga al
  activar la extensión y al cambiar de workspace (`agents/roles.ts`:
  `loadCustomAgents`/`saveCustomAgent`/`getCustomAgentsSync`), y queda disponible como
  `@nombre-del-agente` en el chat igual que los roles incluidos.
  **Limitación real, no oculta**: el agente custom solo define su `systemPrompt`. No
  hay enforcement de "tools permitidas" ni "modelo específico" por agente — usa las
  mismas tools y el mismo modelo configurado globalmente que cualquier otro rol. Eso
  requeriría cambiar `agentLoop.ts`/`tools.ts` para filtrar tools por rol, que no se
  hizo en esta pasada.

- **Automation Builder (fase 7) — real, con el límite arquitectónico de una extensión.**
  Nuevo motor `automation/automationEngine.ts`, registrado al activar la extensión.
  Reglas en `.editcore/automations.json` (`{id, trigger, glob, action, payload}`),
  triggers reales: `onSave` y `onCreate` de archivos (vía `vscode.workspace.onDidSaveTextDocument`
  / `onDidCreateFiles`), acciones reales: `chatPrompt` (abre el chat con un prompt,
  pasa por la aprobación normal del agente) o `runCommand` (ejecuta un comando de
  VS Code). Comando `EditCore: Gestionar automatizaciones` (`editcore.manageAutomations`)
  abre/crea el archivo de configuración con un ejemplo desactivado.
  **Limitación real, no oculta**: esto solo corre mientras VS Code está abierto con la
  extensión activa. No hay proceso en background persistente fuera del editor, ni
  forma de recibir webhooks entrantes — eso requeriría un servidor, que no existe ni se
  fabricó.

- **Product Factory con cobros (fase 12) — real como generador de código, no como
  procesador de pagos.**
  Nuevo rol `@billing` en `agents/roles.ts`: genera integraciones reales (Stripe,
  Mercado Pago, etc. — checkout, webhooks, suscripciones) cuando se le pide, usando
  `.env.example` para credenciales en vez de inventar claves. El system prompt prohíbe
  explícitamente simular que un cobro fue procesado.
  **Lo que sigue sin existir, deliberadamente**: no hay panel de administración de
  facturación generado automáticamente, no hay cuenta de pasarela de pago operada por
  EditCore, y el agente no puede probar un cobro real sin que el usuario tenga su
  propia cuenta con el proveedor — fabricar eso sería inventar una funcionalidad que
  nadie podría verificar.

## 4. Cómo usarlo hoy

1. Comando `EditCore: Generar proyecto desde una idea` (`editcore.generateFromIdea`):
   describir la idea, confirmar activación del pipeline multi-agente, y el chat corre
   el pipeline real. Cada escritura de archivo y cada comando de terminal sigue
   pasando por la aprobación manual ya existente — nada se ejecuta sin confirmación.
2. `@ui-design <pedido>` en el chat — genera código de UI siguiendo la librería del proyecto.
3. `@billing <pedido>` en el chat — genera integraciones de cobro reales (con credenciales del propio usuario).
4. `EditCore: Crear agente personalizado` (`editcore.createCustomAgent`) — define un
   agente propio (`@nombre`) guardado en `.editcore/agents.json`.
5. `EditCore: Gestionar automatizaciones` (`editcore.manageAutomations`) — edita
   `.editcore/automations.json` para definir reglas onSave/onCreate → chatPrompt/runCommand.

## 5. Qué sigue sin existir (límites reales, no pendientes de "ánimo")

- Enforcement de tools/modelo/permisos por agente personalizado (fase 6): todo agente
  custom usa las mismas tools globales; no hay sandboxing por agente.
- Automatizaciones disparadas por eventos externos (webhooks, cron fuera del editor,
  fase 7): requeriría un backend, que EditCore no tiene ni se fabricó aquí.
- Mockups/diseño visual real (fase 4): `@ui-design` genera código, no imágenes.
- Procesamiento de pagos real y panel de administración de facturación (fase 12):
  requiere que el usuario opere su propia cuenta con el proveedor de pagos; EditCore
  no aloja ni procesa transacciones.
