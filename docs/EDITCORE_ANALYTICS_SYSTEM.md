# EditCore — Analytics System: estado real

_Última actualización: 2026-06-29._

## 1. Qué pidió el prompt original

Analítica de uso (usuarios activos, features más usadas, retención, conversión) y
analítica de agentes IA (qué agente se usa más, tasa de éxito, tiempo de respuesta,
satisfacción).

## 2. Qué existe hoy y qué no

| Fase pedida | Estado real | Por qué |
|---|---|---|
| Tools/features más usadas | **Real.** `apiKeyService.ts` cuenta cada llamada a tool (`write_file`, `run_command`, etc.) acumulado por instalación | `UsageTotals.toolCalls` |
| Uso por agente/rol | **Real, parcial.** Cuando se invoca un rol con `@rol` desde el chat principal (`chatParticipant.ts`), cada llamada a tool se cuenta también contra ese rol (`toolCallsByRole`). Si se invoca el agente desde otros puntos de entrada (panel lateral, multi-agent pipeline) sin pasar el rol, esa llamada cae solo en el conteo general | `apiKeyService.recordToolCall(toolName, roleId)` |
| Costos y tokens | **Real.** Acumulado y por sesión actual, con estimación de costo en USD por modelo | `apiKeyService.ts` (`MODEL_PRICING`, `estimateCostUsd`) |
| Tasa de aprobación/cancelación de propuestas del agente | **Real, local.** Se calcula sobre `.editcore/audit.jsonl`, contando decisiones `run/edit/cancel` (comandos) y `apply/cancel` (escrituras de archivo) | `intelligence/recommendationEngine.ts` (`computeDecisionStats`) |
| Usuarios activos / retención / conversión | **No existe y no se fabricó.** Requiere telemetría agregada entre instalaciones/usuarios, que implica un backend con consentimiento explícito de recolección — EditCore no tiene ninguno de los dos | — |
| Tiempo de respuesta por agente | **No existe.** No se mide latencia de respuesta por rol; sería fabricar una métrica sin instrumentación real detrás | — |
| Satisfacción del usuario | **No existe.** No hay mecanismo de feedback/rating en la UI que alimente esto | — |

## 3. Cómo se ve esto hoy

El comando `EditCore: Command Center` (`editcore.intelligence.commandCenter`)
muestra, en una sola corrida:
- Tools más usadas (top 10).
- Uso por agente/rol (`@arquitecto`, `@qa`, etc.) cuando hay datos.
- Tasa de cancelación de propuestas del agente.

No hay un dashboard separado de "analítica" — vive dentro del Command Center para
no duplicar UI (ver `EDITCORE_COMMAND_CENTER.md`).

## 4. Qué se necesitaría para lo que falta

Usuarios activos, retención y tiempo de respuesta por agente solo serían reales si
EditCore tuviera un backend con telemetría opt-in. No es parte de este cambio:
documentarlo como faltante es preferible a inventar números.
