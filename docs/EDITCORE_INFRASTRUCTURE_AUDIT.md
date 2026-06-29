# EditCore — Auditoría de Infraestructura

_Última actualización: 2026-06-29. Este documento describe el estado **real** del
repositorio en este momento. No describe una plataforma SaaS desplegada, porque
esa plataforma no existe todavía — ver "Qué falta" al final._

## 1. Qué es EditCore hoy

EditCore es, técnicamente, **dos extensiones de VS Code** y **una landing page estática**.
No hay servidor backend, no hay base de datos, no hay usuarios autenticados contra
un servicio propio, y no hay infraestructura cloud propia más allá del hosting
estático de la web de descarga.

| Componente | Qué es | Dónde corre |
|---|---|---|
| `extensions/editcore-claude` | Extensión VS Code: chat, Agent Mode, herramientas (`write_file`, `run_command`, etc.), RAG local, gestión de API keys | En la máquina del usuario, dentro de su VS Code |
| `extensions/editcore-connect` | Segunda extensión (compilación verificada en CI) | En la máquina del usuario |
| `web/` | Landing + página de descarga (`index.html`, `download.html`) | GitHub Pages (`.github/workflows/pages.yml`) y/o Vercel (`vercel.json`) |
| `releases/` | Artefactos `.vsix` generados por releases con tag | GitHub Releases |
| `scripts/apply-editcore-patches.js` | Parches sobre Code-OSS para producir el IDE "EditCore" como fork | Build manual/CI, no en producción de usuarios |

## 2. Hosting y despliegue actual

- **Web estática**: dos pipelines coexisten — `pages.yml` (GitHub Pages, build con Python/Pillow/fpdf2 para generar iconos y un PDF) y `vercel.json` (apunta `outputDirectory: web`). Confirmar cuál es el canal "oficial" hoy; tener ambos activos es redundante y puede generar confusión sobre cuál URL es la real.
- **Extensiones**: no se publican a un marketplace público en este pipeline (no hay step de `vsce publish` en `editcore-release.yml`); el release crea el `.vsix` y lo adjunta a un GitHub Release. La distribución es manual/descarga directa.
- **No hay ambientes** (dev/staging/production) en el sentido de infraestructura desplegada, porque no hay servicio desplegado que tenga ambientes.

## 3. Base de datos y almacenamiento

- **No existe ninguna base de datos.** Todo el estado persistente vive en la máquina del usuario:
  - API keys: `vscode.ExtensionContext.secrets` (Secret Storage del propio VS Code, cifrado por el SO).
  - Uso/costos de IA: `context.globalState` (`apiKeyService.ts`, clave `editcore.usageTotals`) — token counts, costo estimado, conteo de tool calls, todo **local y por instalación**, no centralizado.
  - Memoria de proyecto, ADRs, índice RAG: archivos en `.editcore/` dentro de cada workspace del usuario.
- No hay almacenamiento de objetos (S3-like), no hay cache distribuido (Redis), no hay colas de mensajes — porque no hay backend que los necesite.

## 4. APIs y servicios externos

- Llamadas directas desde el cliente (la extensión, en la máquina del usuario) a:
  - Anthropic API (`anthropicClient.ts`, SDK oficial `@anthropic-ai/sdk`).
  - OpenAI API (`openaiClient.ts`).
  - OpenRouter (opcional, `providers/openRouterClient.ts`).
  - Ollama local (opcional, `providers/ollamaClient.ts`).
  - Servidores MCP configurados por el usuario en `.editcore/mcp.json`.
- **No hay un backend propio de EditCore actuando de proxy/gateway** entre el usuario y estas APIs. Cada usuario usa su propia API key, guardada localmente. Esto implica que EditCore **no puede hoy** facturar centralizadamente el uso de IA, ni aplicar límites por organización, ni ver telemetría agregada de todos los usuarios — porque no hay ningún punto central por donde pase ese tráfico.

## 5. CI/CD actual (real, ya funcionando)

- **`editcore-ci.yml`**: en cada push/PR a `main`/`master`, compila `editcore-claude` y `editcore-connect`, corre `npm test` y un test suite de utilidades RAG (`node --test test/rag-utils.test.js`). Corre en `windows-latest`. La validación del patch script tiene `continue-on-error: true` (no bloquea el pipeline si falla).
- **`editcore-release.yml`**: dispara con tags `v*.*.*` o manualmente; sincroniza versión, compila, genera el manifiesto/`.vsix` y crea el GitHub Release.
- **`pages.yml`**: dispara con cambios en `web/**`; genera assets y despliega a GitHub Pages.
- No hay step de seguridad (SAST, `npm audit`, secret scanning) en ningún pipeline.
- No hay step de linting obligatorio.

## 6. Logs y observabilidad actual

- No hay logs centralizados. Los `console.log`/output de la extensión van al "Output" panel de VS Code del propio usuario, visibles solo para él.
- `auditService.ts` y `observability.ts` existen en el código (`src/platform/`) — confirmar qué tan completos están y si producen algún registro persistente más allá de la sesión local, o si son utilidades pensadas para una fase futura.
- No hay forma de saber, como mantenedores de EditCore, cuántos usuarios activos hay, qué errores están viendo, o cuánto IA están gastando — toda esa información, si existe, está atrapada en la máquina de cada usuario.

## 7. Seguridad actual

- Las API keys se guardan con Secret Storage de VS Code (correcto, es el mecanismo seguro estándar).
- `resolveSafePath` en `agent/tools.ts` evita que las tools del agente escriban fuera del workspace — control de seguridad real y verificado en este repo.
- Toda escritura de archivo y todo comando de terminal del Agent Mode requieren aprobación manual del usuario (`showDiffAndConfirm`, `requestCommandApproval`) — esto ya es una mitigación de seguridad real contra ejecución no controlada.
- No hay gestión de secretos a nivel de organización, ni rotación de keys, ni auditoría centralizada de accesos, porque no hay backend ni organización multi-usuario.

## 8. Riesgos identificados (reales, sobre el código actual)

1. **Doble pipeline de despliegue web** (GitHub Pages + Vercel) sin que quede claro en el repo cuál es la fuente de verdad — riesgo de servir contenido desactualizado desde una de las dos.
2. **Sin `npm audit`/escaneo de dependencias en CI** — vulnerabilidades en dependencias (SDKs de Anthropic/OpenAI, etc.) no se detectan automáticamente.
3. **`continue-on-error: true`** en la validación de parches enmascara fallos reales sin que nadie se entere desde CI.
4. **Costos/uso de IA no son visibles para el equipo de EditCore** — solo el usuario final ve su propio gasto. Si el objetivo de negocio es ofrecer planes pagos o límites, hoy no hay ningún dato centralizado para soportarlo.
5. **CI corre en `windows-latest` para todo**, lo cual es más lento/caro que `ubuntu-latest` sin que haya, a priori, una dependencia de Windows en el código de las extensiones (a confirmar).

## 9. Recomendaciones inmediatas (sin construir backend nuevo)

- Definir cuál de los dos despliegues web (Pages vs Vercel) es el oficial y desactivar/documentar el otro como backup.
- Agregar `npm audit --audit-level=high` (o Dependabot) a `editcore-ci.yml`.
- Quitar o justificar el `continue-on-error: true` del patch script.
- Evaluar mover el job de CI a `ubuntu-latest` si no hay dependencia real de Windows, para abaratar y acelerar el pipeline.
- Si se quiere visibilidad de costos de IA agregada, la única vía honesta sin backend es que el usuario exporte/comparta voluntariamente su `UsageTotals` local — no existe (ni debería inventarse) un mecanismo de recolección automática sin que el usuario lo sepa.

## 10. Qué falta para ser una "plataforma SaaS empresarial"

Esto es lo que pedía originalmente el Prompt 7 (FASES 2–3, 5–13) y que **no se puede auditar ni construir incrementalmente** sobre el código actual porque depende de decisiones de producto que todavía no están tomadas:

- ¿EditCore va a tener cuentas de usuario y equipos gestionados centralmente, o sigue siendo "cada usuario con su propia API key"?
- Si hay cuentas centralizadas: ¿dónde se hostea el backend, con qué stack, quién es responsable de pagar y operar esa infraestructura?
- Sin esa decisión, cualquier documento sobre "arquitectura cloud escalable", "escalamiento automático", "alta disponibilidad" o "admin center" describiría un sistema que no existe — y por eso no se generaron en esta auditoría.

Cuando exista esa decisión de producto, este documento debe actualizarse con una Fase 2 real (arquitectura del backend elegido) en lugar de la genérica que pedía el prompt original.
