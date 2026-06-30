# EditCore Change Log (Prompt 21 — Fase 7)

Registro de cambios reales, derivado del historial real de `git log` (no reconstruido de memoria). Se mantiene hacia adelante a partir de este prompt; el historial anterior se resume desde commits reales como contexto.

## Resumen histórico (de `git log`, commits reales)

| Commit | Prompt / cambio |
|---|---|
| `c51e5f4`...`1de7fbf` | Login web (correo+contraseña), robustez del IDE, vínculo usuario↔organización |
| `c09fa5b` | API pública v1, developer keys, SDK TypeScript, portal de desarrolladores (Prompt 11) |
| `6781544` | Self Evolution: auditorías programadas, propuestas con aprobación (Prompt 12) |
| `d8af8c1` | Enterprise Architect IA, biblioteca de arquitecturas (Prompt 13) |
| `b70f7bd` | Software Factory: pipeline de proyectos/tareas/releases (Prompt 14) |
| `47ed656`, `76bfd43` | AI Operating System: núcleo de inteligencia central (Prompt 15) + fix de columna reservada en Postgres |
| `ddda040` | Agent Network: red global autónoma de inteligencia (Prompt 16) |
| `16ef9f9` | Enterprise Operating Model: OKRs, finanzas, org chart (Prompt 17) |
| `641f3a9` | Innovation Lab: ideas, experimentos, startups (Prompt 18) |
| `7de3a9e`, `3175f5f` | Browser Agent: Playwright, búsqueda y navegación web real |
| `939095b` | Digital Enterprise: CEO Intelligence, ventas, marketing, soporte, governance (Prompt 19) |
| `1a68a2f` | Master architecture audit + Global Command Center (Prompt 20) |

## Entradas de este prompt (Prompt 21)

### 2026-06-30 — Prompt 21: Implementation Command (auditoría, roadmap, sin código de producto nuevo)

- **Tipo de cambio**: documentación + análisis. Sin nuevas tablas, sin nuevos endpoints de producto.
- **Archivos creados**:
  - `docs/EDITCORE_CURRENT_STATE_REPORT.md`
  - `docs/EDITCORE_REAL_ARCHITECTURE_MAP.md`
  - `docs/EDITCORE_GAP_ANALYSIS.md`
  - `docs/EDITCORE_MASTER_ROADMAP.md`
  - `docs/EDITCORE_AI_MODEL_STRATEGY.md`
  - `docs/EDITCORE_DEV_AGENTS.md`
  - `docs/EDITCORE_PROJECT_MEMORY.md`
  - `docs/EDITCORE_SPRINT_SYSTEM.md`
  - `docs/EDITCORE_CHANGE_LOG.md` (este archivo)
- **Revisión de código**: lectura directa de `package.json`, `.gitignore`, `vercel.json`, `.github/workflows/editcore-ci.yml`, estructura completa de `api/`, `lib/`, `docs/`.
- **Pruebas**: `npx tsc --noEmit` sobre todo el proyecto → sin errores (confirmado, no se modificó código de producto en este prompt).
- **Seguridad**: confirmado que ningún `.env` real está versionado (`git ls-files | grep env` solo devuelve `.env.example` sin valores).
- **Hallazgos**: CI existente no cubre `api/`/`lib/` (solo extensiones del IDE); 2+ pares de docs con nombres solapados; catálogo de modelos solo incluye Anthropic pese a que el prompt pedía también OpenAI (documentado como brecha real, no fabricado).
- **Próximos pasos**: ejecutar `EDITCORE_MASTER_ROADMAP.md` Prioridad 1 (P1.1 — tests de `lib/`, P1.2 — CI extendido) en un prompt/sprint futuro, siguiendo `EDITCORE_SPRINT_SYSTEM.md`.

### 2026-06-30 — Flujo real de registro → plan gratuito → descarga

- **Tipo de cambio**: código de producto + 1 migración SQL aditiva.
- **Motivo**: la landing (`web/index.html`) ofrecía descarga directa sin registro; se pidió pasar a registro → plan → descarga, con un solo plan real por ahora ("Community", gratis).
- **Archivos modificados**:
  - `web/index.html`: el CTA principal cambia de "Descargar EditCore" a "Registrarse" (enlaza a `/login.html`); se quitó el script que reescribía ese botón con la URL del último release.
  - `web/account.html`: muestra el plan real de la organización (`free` → "Community (gratis)", etc.) y agrega el botón real de descarga + versión dinámica (lógica movida desde `index.html`).
  - `supabase/migrations/0014_auto_org_on_signup.sql` (nueva): trigger `on_auth_user_created` sobre `auth.users` que crea automáticamente una `organization` en plan `free` y un `profile` como `owner` al registrarse — reemplaza el proceso manual que existía en `0003_link_user_to_org.sql` (correr SQL a mano por cada usuario), que no escalaba.
- **Pruebas**: `npx tsc --noEmit` → sin errores.
- **Lo que NO se hizo (gap real, documentado)**: el pop-up de inicio de sesión dentro del IDE de escritorio al abrir la app no se implementó — el código fuente del shell de escritorio (fork de Code-OSS) no está en este repositorio, que solo contiene `extensions/editcore-claude` y `extensions/editcore-connect` más el backend web. Implementarlo requiere trabajar en el repo del IDE de escritorio, fuera del alcance de este cambio.
- **Próximo paso real**: cuando exista acceso al repo del shell de escritorio, agregar ahí una pantalla de login obligatoria al primer arranque que valide contra el mismo Supabase Auth (`EDITCORE_SUPABASE_URL`/`EDITCORE_SUPABASE_ANON_KEY`) ya usado en `web/login.html`.

### 2026-06-30 — Fix de raíz: el agente decía "no puedo tocar código / respuestas simuladas / sin permiso"

- **Tipo de cambio**: fix de comportamiento real en el agente del IDE (`extensions/editcore-claude`), sin nuevas dependencias.
- **Síntoma reportado por el usuario**: al usar el chat/agente real de EditCore, el modelo respondió que no podía tocar código, que sus respuestas eran simuladas y que no tenía permiso para tocar su propio código.
- **Causa raíz encontrada (no es una limitación inventada del producto)**: en `extensions/editcore-claude/src/agent/agentLoop.ts`, cuando no había una API Key de **Claude (Anthropic)** configurada (aunque hubiera una de OpenAI), el modo Agent degradaba **silenciosamente** a una respuesta de OpenAI **sin ninguna herramienta conectada** (sin `read_file`/`write_file`/`apply_patch`/etc.), con el prompt literal `"El agente Claude no está disponible. Responde como asistente de código (sin herramientas)"` (función `agentFallbackResponse` en `aiRouter.ts`). El único aviso al usuario era un texto pequeño en cursiva, fácil de no notar. En ese modo, el modelo decía la verdad: genuinamente no tenía herramientas conectadas en ese momento — confirmado leyendo `extensions/editcore-claude/src/agent/tools.ts` (`AGENT_TOOLS`, implementaciones reales con `fs.promises.*`) y comprobando que esas tools solo se pasan a la llamada cuando el proveedor es Claude.
- **Archivos modificados**:
  - `extensions/editcore-claude/src/agent/agentLoop.ts`: se eliminó la degradación silenciosa a modo sin herramientas (en ambos puntos: sin API Key de Claude, y cuando la llamada a Claude falla a mitad de tarea). Ahora el modo Agent muestra un error explícito indicando que necesita una API Key de Claude para tener herramientas reales de archivos, y que el chat normal sin Claude responde solo texto.
  - `extensions/editcore-claude/src/aiRouter.ts`: se eliminó la función `agentFallbackResponse`, ya sin uso, para no dejar código muerto que reintroduzca el mismo problema más adelante.
- **Pruebas**: `npx tsc --noEmit -p extensions/editcore-claude` → sin errores; `npm run compile` (genera `out/`) → sin errores; verificado por grep que el mensaje nuevo quedó en el JS compilado (`out/agent/agentLoop.js`, que no se versiona, está en `.gitignore`).
- **Validación**: pendiente de confirmación del usuario probando el modo Agent real con su API Key de Claude configurada.
- **Próximo paso real**: si el usuario reporta el mismo síntoma con la API Key de Claude ya configurada, el siguiente sospechoso a revisar es si está usando el panel de **chat normal** (sin herramientas por diseño, ese modo solo conversa) en vez del panel **Agent** (el que sí tiene herramientas) — los dos modos existen por separado en el código (`chatViewProvider.ts`/`chatParticipant.ts` vs `agentPanel.ts`).

### 2026-06-30 — Narración de progreso en el panel de chat nativo + auto-aplicar cambios de bajo riesgo

- **Tipo de cambio**: fix de comportamiento real en el agente del IDE (`extensions/editcore-claude`), sin nuevas dependencias.
- **Síntoma reportado por el usuario**: en el panel de chat principal (el registrado vía `vscode.chat.createChatParticipant` en `chatParticipant.ts`), durante una tarea de Agent solo se veía la etiqueta nativa de VS Code "Thinking" parpadeando, sin ningún detalle de qué estaba haciendo el agente, a diferencia de Claude Code (este asistente), que narra cada paso.
- **Causa raíz encontrada**: el estilo de comunicación por defecto `editcore.agent.style = "cursor"` hace que `shouldShowToolProgressInChat()` devuelva `false`, por lo que `streamAgentEvent()` en `chatParticipant.ts` no llamaba a `stream.markdown(...)` en ningún evento `tool_call_start`. Como el panel de chat es la API nativa de chat de VS Code, mientras el handler no llama a ningún método de `stream`, VS Code sigue mostrando su indicador genérico "Thinking" — no hay forma de narrar sin usar la API de `stream`.
- **Archivos modificados**:
  - `extensions/editcore-claude/src/chatParticipant.ts`: se agregó una llamada a `stream.progress(...)` (indicador transitorio nativo de VS Code, no persiste en el historial del chat) en cada `tool_call_start`, con un mensaje breve generado por la nueva función `describeToolProgress(name, input)` (p. ej. "Leyendo src/app/layout.tsx…", "Ejecutando: npm run build…"). Esto se hace siempre, independientemente del estilo `cursor`/`verbose`, porque `stream.progress` es justamente el mecanismo de VS Code para reemplazar el "Thinking" genérico por un estado real, sin contradecir el diseño de "cero texto narrado en la respuesta final" del estilo `cursor`.
  - `extensions/editcore-claude/src/agent/tools.ts` (`showDiffAndConfirm`): se terminó de conectar el setting `editcore.agent.autoApplyLowRisk` (agregado en un cambio anterior a `package.json` pero nunca usado) — cuando está en `true` y `analyzeFileImpact` clasifica el cambio como riesgo `low`, el archivo se aplica directamente sin el diálogo modal de confirmación (queda igual de auditado vía `appendAudit` con `action: 'auto_apply_low_risk'`). Los archivos nuevos (sin impacto calculado) y los de riesgo medio/alto siguen pidiendo confirmación siempre.
- **Pruebas**: `npx tsc --noEmit -p extensions/editcore-claude` → sin errores; `npm run compile` → sin errores.
- **Validación**: pendiente de confirmación del usuario probando en el IDE real tras recompilar/reinstalar la extensión.

### 2026-06-30 — Auto-abrir el browser cuando se corre el dev server manualmente en terminal

- **Tipo de cambio**: feature nueva real en `extensions/editcore-claude`, sin nuevas dependencias.
- **Síntoma reportado por el usuario**: al escribir `npm run dev` directamente en la terminal integrada (sin usar ningún botón de EditCore), el browser embebido no se abre/recarga solo cuando el servidor queda listo, a diferencia de Cursor.
- **Causa raíz encontrada**: toda la lógica de espera de puerto real (`localPreview.ts`: `findActivePort`, `waitForAnyPort`, `isPortReady` con sondeo HTTP real) solo se disparaba desde los comandos `editcore.openBrowser` / `editcore.previewLocal` (botón "Browser" de la barra inferior, registrados en `hub/quickActionsBar.ts`). No existía ningún listener sobre las terminales para detectar que el usuario corrió un comando de servidor de desarrollo por su cuenta.
- **Archivos modificados**:
  - `extensions/editcore-claude/src/preview/devServerWatcher.ts` (nuevo): usa `vscode.window.onDidStartTerminalShellExecution` (API de shell integration de VS Code) para detectar comandos que matchean `npm/pnpm/yarn/bun run dev|start`, `next dev` o `vite` en **cualquier** terminal; al detectarlo, sondea los puertos candidatos del proyecto (`candidateDevPorts`) hasta 60s y abre el browser integrado en cuanto responde.
  - `extensions/editcore-claude/src/preview/localPreview.ts`: se exportó `findActiveDevPortFromList(ports, timeoutMs)`, reutilizando el sondeo HTTP real ya existente (`findActivePort`/`waitForAnyPort`), para que el watcher no duplique lógica.
  - `extensions/editcore-claude/src/extension.ts`: se registra `registerDevServerWatcher(context)` en `activate()`.
- **Pruebas**: `npx tsc --noEmit -p extensions/editcore-claude` → sin errores; `npm run compile` → sin errores.
- **Validación**: pendiente de confirmación del usuario probando en el IDE real (requiere que `terminal.integrated.shellIntegration.enabled` esté activo, que es el valor por defecto de VS Code/Code-OSS).

### 2026-06-30 — Fix de raíz: el auto-abrir browser dependía de shell integration que no funcionaba en PowerShell del usuario

- **Tipo de cambio**: fix de comportamiento real en `extensions/editcore-claude`, sin nuevas dependencias.
- **Síntoma reportado por el usuario**: tras instalar el watcher basado en `vscode.window.onDidStartTerminalShellExecution` (cambio anterior, commit `6bc6774`), corriendo `npm run dev` en una terminal nueva de Windows PowerShell, el browser seguía sin abrirse solo — el usuario tenía que seguir haciendo clic manual en el botón "Browser".
- **Causa raíz encontrada**: `onDidStartTerminalShellExecution` depende por completo de que el shell integration de VS Code esté realmente activo en esa terminal. En Windows PowerShell (`powershell.exe`, no PowerShell 7/`pwsh`), esa integración requiere el módulo `PSReadLine` en una versión reciente (2.2.2+); Windows suele traer una versión más vieja preinstalada, y cuando eso pasa el script de integración de VS Code se inyecta pero no llega a emitir los eventos de inicio/fin de comando — silenciosamente, sin ningún error visible. El mecanismo anterior dependía 100% de ese evento, así que en ese entorno nunca se disparaba.
- **Archivos modificados**:
  - `extensions/editcore-claude/src/preview/devServerWatcher.ts`: reescrito por completo. Ya no escucha eventos de terminal; ahora hace un sondeo HTTP real en segundo plano cada 3 segundos sobre los puertos candidatos del dev server del proyecto (reutilizando `findActivePort`, que ya hacía sondeo HTTP real), y abre el browser integrado en cuanto detecta una transición de "puerto caído" a "puerto respondiendo" — funciona sin importar qué shell use el usuario (PowerShell, cmd, bash, etc.), porque no depende de detectar comandos de terminal en absoluto. Tiene un cooldown de 5 minutos entre auto-aperturas para no pelear con cierres manuales del usuario.
  - `extensions/editcore-claude/src/preview/localPreview.ts`: se exportó la función interna `findActivePort` (antes privada) para que el watcher la reutilice sin duplicar la lógica de sondeo HTTP.
- **Pruebas**: `npx tsc --noEmit -p extensions/editcore-claude` → sin errores; `npm run compile` → sin errores.
- **Validación**: pendiente de confirmación del usuario probando en su IDE real tras `git pull` + `scripts\deploy-extensions-to-portable.ps1`.

### 2026-06-30 — Diagnóstico real (canal de Output) para el auto-abrir del browser, porque dos intentos previos no funcionaron en el entorno real del usuario

- **Tipo de cambio**: instrumentación de diagnóstico real + fix de robustez en `extensions/editcore-claude`, sin nuevas dependencias.
- **Contexto**: tras dos arreglos previos del auto-abrir del browser (commits `6bc6774` y `a09cae1`), el usuario confirmó con capturas y pruebas reales en su entorno (EditCore portable en `D:\EDITCORE`, proyecto Conectxi) que el browser seguía sin abrirse solo, incluso con el deploy ya aplicado. No había evidencia concreta de en qué punto fallaba (¿no se registra el watcher? ¿no detecta el `package.json`? ¿el sondeo HTTP no encuentra el puerto? ¿el comando de abrir browser falla?), así que seguir cambiando el mecanismo de detección a ciegas (intento 3 sin datos) hubiera sido otra "compostura fallida" en vez de una solución de raíz.
- **Causa raíz potencial identificada (no confirmada aún, pendiente de los logs reales)**: `registerDevServerWatcher` leía `vscode.workspace.workspaceFolders?.[0]` una sola vez, de forma síncrona, en el momento de `activate()`. Si la carpeta del workspace no estuviera todavía adjunta en ese instante exacto (por ejemplo, por una posible carrera entre la restauración automática de la carpeta Conectxi y la activación de la extensión en el build portable, build que ya tiene varios scripts de parche dedicados a forzar que `editcore-claude` cargue de forma confiable — `patch-portable-force-editcore-claude-startup.js`, `patch-portable-always-load-editcore-claude.js`), el watcher se salía sin hacer nada y nunca se enteraba de que después sí había una carpeta abierta.
- **Archivos modificados**:
  - `extensions/editcore-claude/src/preview/devServerWatcher.ts`: ahora crea un canal de salida real (`vscode.window.createOutputChannel("EditCore: Dev Server Watcher")`) y registra ahí cada paso real: si no hay carpeta al activar (y queda escuchando `vscode.workspace.onDidChangeWorkspaceFolders` en vez de no hacer nada), si detectó o no script `dev`/`start`, qué framework y puertos va a sondear, cuándo un puerto pasa de "caído" a "respondiendo", cuándo intenta abrir el browser, y cualquier error real del ciclo de sondeo (antes el `catch` lo silenciaba por completo, ocultando la causa real si la hubiera).
  - `extensions/editcore-claude/src/preview/localPreview.ts`: se eliminó `findActiveDevPortFromList`, código muerto desde la reescritura del watcher en el commit `a09cae1` (ya no lo usaba nada).
- **Pruebas**: `npx tsc --noEmit -p extensions/editcore-claude` → sin errores; `npm run compile` → sin errores.
- **Validación**: pendiente de que el usuario haga `git pull` + `deploy-extensions-to-portable.ps1`, abra el panel **Output** (Ctrl+Shift+U) en EditCore, seleccione el canal **"EditCore: Dev Server Watcher"** en el desplegable, corra `npm run dev` en una terminal nueva, y comparta el texto real que aparece ahí — eso da evidencia concreta para el siguiente paso en vez de seguir adivinando a ciegas.

## Cómo se actualiza este archivo a futuro

Cada sprint ejecutado desde `EDITCORE_MASTER_ROADMAP.md` agrega una entrada nueva siguiendo el mismo formato (fecha, tipo, archivos, pruebas, hallazgos, próximos pasos), inmediatamente después de la última entrada — no se reescriben entradas anteriores.
