# EditCore — Recommendation Engine: estado real

_Última actualización: 2026-06-29._

## 1. Qué pidió el prompt original

Un motor que analice patrones de uso y genere recomendaciones inteligentes y
accionables para mejorar el producto, con auto-optimización basada en esos
patrones.

## 2. Qué existe hoy

**Real, con una llamada real a Claude, sin auto-aplicar nada.**

- `intelligence/recommendationEngine.ts` junta tres fuentes 100% locales:
  1. El `HealthReport` ya existente (`healthMonitor.ts`).
  2. El snapshot de uso/costos de `apiKeyService.ts` (tokens, costo, tools más
     usadas, uso por rol).
  3. Estadísticas de decisiones de aprobación del propio usuario, calculadas
     sobre `.editcore/audit.jsonl` (cuántas propuestas del agente se ejecutaron,
     se editaron o se cancelaron).
- Con esos tres datasets reales, construye un prompt explícito (`buildRecommendationPrompt`)
  que le pide a Claude 3 a 6 recomendaciones concretas, priorizadas, **basadas
  solo en los datos provistos**, y le indica explícitamente que diga "no hay
  datos suficientes" en vez de inventar.
- La llamada es real: usa la API key de Claude ya configurada y el modelo activo
  del usuario (`generateRecommendations` en `recommendationEngine.ts`).
- El resultado se agrega como sección del reporte del Command Center y también se
  guarda en `.editcore/reports/command-center-<fecha>.md`.

## 3. Qué NO hace (y por qué es honesto, no una limitación oculta)

- **No aplica ningún cambio automáticamente.** Las recomendaciones son texto en
  un reporte; si el usuario quiere actuar, lo hace pidiéndoselo al agente por el
  chat, que sigue pasando por las aprobaciones manuales normales
  (`requestCommandApproval`, `showDiffAndConfirm`). No hay "self-optimization"
  autónoma — sería peligroso y no fue lo que se pidió en `quiero que todo sea
  real` (nada se ejecuta sin aprobación).
- **No tiene memoria de qué recomendaciones ya se hicieron** ni hace seguimiento
  de si se aplicaron — cada corrida es independiente.
- **Sin API key de Claude configurada, no genera recomendaciones de IA** (lo dice
  explícitamente en el reporte) — solo muestra el dashboard local de datos.

## 4. Cómo usarlo

`EditCore: Command Center` → elegir "Sí, generar" cuando se pregunta si generar
recomendaciones con IA. Sin esa confirmación, el comando solo muestra el dashboard
local (sin llamada a la API, sin costo).
