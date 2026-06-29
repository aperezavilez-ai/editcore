# EditCore — Command Center: estado real

_Última actualización: 2026-06-29._

## 1. Qué pidió el prompt original

Un "Command Center" que muestre de un vistazo el estado de salud del sistema,
métricas de uso, decisiones recientes y recomendaciones — la cabina de control de
la inteligencia de EditCore.

## 2. Qué existe hoy

**Real, un solo comando que agrega cuatro fuentes de datos locales ya reales:**

Comando: `EditCore: Command Center (uso, costos, decisiones, recomendaciones)`
(`editcore.intelligence.commandCenter`), implementado en
`intelligence/intelligenceCommands.ts` sobre `intelligence/recommendationEngine.ts`.

Al ejecutarlo:
1. Calcula el `HealthReport` (diagnósticos, performance, MCP, eventos recientes).
2. Lee el snapshot de uso/costos acumulado (`apiKeyService.getSnapshot()`),
   incluyendo tools más usadas y uso por agente/rol.
3. Lee y resume `.editcore/audit.jsonl` filtrando solo las entradas de tipo
   `decision` (aprobaciones/cancelaciones de comandos y escrituras de archivo).
4. Pregunta si el usuario quiere además recomendaciones generadas por Claude
   (llamada real, opcional, con su propia API key) y las agrega como sección.
5. Abre el reporte como markdown con vista previa, y lo guarda en
   `.editcore/reports/command-center-<fecha>.md` para consulta posterior.
6. Dispara dos "Smart Alerts" simples si corresponde (ver sección 4).

## 3. Qué NO es

- **No es un dashboard en tiempo real ni un webview con gráficos.** Es un reporte
  markdown generado on-demand. Se eligió este formato porque es 100% real con el
  código existente (mismo patrón que `Health Monitor` y `System Snapshot`) en vez
  de fabricar un panel visual nuevo sin datos reales detrás que mostrar en vivo.
- **No agrega datos de otros usuarios o instalaciones.** Todo lo que muestra es de
  este workspace y esta instalación de VS Code.

## 4. Smart Alerts (fase 11) — real, basadas en umbrales locales

Implementadas dentro del mismo comando, sin infraestructura nueva:
- Si ≥5 decisiones registradas y más del 40% fueron canceladas → aviso de que el
  agente está proponiendo cambios que el usuario rechaza seguido (señal real de
  fricción, calculada sobre datos reales).
- Si el Health Monitor devuelve estado `critical` → aviso explícito.

No hay alertas por email/Slack ni notificaciones fuera del editor — eso requeriría
integraciones que no se pidieron ni se fabricaron aquí.

## 5. Cómo usarlo

1. Activar `editcore.intelligence.enabled` (panel de configuración o settings.json).
2. Ejecutar `EditCore: Command Center (uso, costos, decisiones, recomendaciones)`
   desde la paleta de comandos.
