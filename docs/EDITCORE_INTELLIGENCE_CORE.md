# EditCore — Intelligence Core: estado real

_Última actualización: 2026-06-29. Mismo criterio que el resto de `docs/EDITCORE_*.md`:
solo se describe lo que existe y se puede verificar en este repositorio._

## 1. Qué pidió el prompt original

Un "Intelligence Core" central que entienda el estado completo del producto, los
agentes y el negocio, y alimente analítica, recomendaciones, monitoreo predictivo,
auto-optimización, inteligencia de producto y de negocio, todo en tiempo real.

## 2. Qué existe hoy

EditCore **no tiene backend ni base de datos propia**: todo corre dentro de la
extensión de VS Code, en la máquina del usuario, sobre el workspace abierto. Por
eso el "Intelligence Core" real es **local y por instalación**, no una plataforma
central que vea múltiples usuarios o clientes.

Lo que sí existe y es real:

| Pieza | Estado | Dónde está |
|---|---|---|
| Health Monitor | **Real.** Corre diagnósticos del proyecto, mide stats de performance (`.editcore/stats.json`), prueba salud de MCP y lee eventos de observabilidad recientes; calcula un estado `healthy/degraded/critical` | `intelligence/healthMonitor.ts` (`buildHealthReport`) |
| System Snapshot | **Real.** Describe módulos activos, integraciones, configuración y comandos disponibles del workspace actual | `intelligence/systemReader.ts` |
| Uso y costos | **Real, acumulado por instalación.** Tokens, requests, costo estimado USD y conteo de llamadas a tools, persistido en `globalState` de VS Code | `apiKeyService.ts` (`UsageTotals`, `recordUsage`, `recordToolCall`) |
| Auditoría/decisiones | **Real, local.** Cada aprobación/edición/cancelación de un comando de terminal o de una escritura de archivo se registra en `.editcore/audit.jsonl` | `enterprise/orgConfig.ts` (`appendAudit`), `agent/terminalApproval.ts`, `agent/tools.ts` (`showDiffAndConfirm`) |
| Agregador (Command Center) | **Real.** Junta los cuatro puntos anteriores en un solo reporte markdown, generado on-demand | `intelligence/recommendationEngine.ts` (`gatherCommandCenterData`), comando `editcore.intelligence.commandCenter` |

## 3. Qué NO existe y por qué no se fabricó

- **No hay tiempo real ni "siempre corriendo".** Todo se genera on-demand cuando el
  usuario ejecuta un comando (`EditCore: Command Center`, `EditCore: Health Monitor`,
  etc.). No hay un proceso en background fuera de VS Code ni un scheduler con cron
  real (ver límites de Automation Builder en `EDITCORE_AI_FACTORY.md`).
- **No hay datos multi-usuario ni multi-cliente.** "Inteligencia de negocio" en el
  sentido de usuarios activos, retención o adopción entre clientes requeriría un
  backend con telemetría agregada que EditCore no tiene. Inventar esos números
  violaría la regla de "todo real" del proyecto.
- **No hay aprendizaje/reentrenamiento del modelo.** El log de decisiones
  (aprobado/editado/cancelado) es un dataset local que el motor de recomendaciones
  puede leer y citar, pero no hay pipeline de fine-tuning ni ajuste de pesos.

## 4. Cómo usarlo hoy

1. `EditCore: Health Monitor (SIL)` — diagnóstico puntual del proyecto.
2. `EditCore: Snapshot del sistema (SIL)` — mapa del workspace actual.
3. `EditCore: Command Center (uso, costos, decisiones, recomendaciones)` — agrega
   todo lo anterior más el log de decisiones y, opcionalmente, recomendaciones
   reales generadas por Claude. Ver `EDITCORE_COMMAND_CENTER.md`.

Los tres requieren `editcore.intelligence.enabled = true` (apagado por defecto, ya
que leen archivos del sistema/proyecto y eso requiere consentimiento explícito).
