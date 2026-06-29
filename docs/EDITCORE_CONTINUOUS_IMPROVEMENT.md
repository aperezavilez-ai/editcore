# EditCore — Continuous Learning / Self Optimization / AI Security Intelligence: estado real

_Última actualización: 2026-06-29._

## 1. Qué pidió el prompt original

Aprendizaje continuo desde el feedback de usuarios, auto-optimización del producto
y monitoreo de seguridad con detección de anomalías y amenazas.

## 2. Continuous Learning (fase 10) — parcial, honesto

**Lo real**: cada vez que el usuario aprueba, edita o cancela una propuesta del
agente (un comando de terminal vía `requestCommandApproval`, o una escritura/parche
de archivo vía `showDiffAndConfirm`), se registra un evento real en
`.editcore/audit.jsonl` con `{type: "decision", kind: "command"|"file_write",
action: "run"|"edit"|"cancel"|"apply", ...}`.

**Lo que NO es**: esto no es "el modelo aprende". No hay reentrenamiento, no hay
ajuste de pesos, no hay fine-tuning. Es un log de decisiones del usuario que el
Recommendation Engine puede leer y citar (por ejemplo, "30% de las propuestas se
cancelan: posible señal de que el agente propone cambios muy grandes"). Llamarlo
"aprendizaje" sin esa aclaración sería fabricar una capacidad que no existe.

## 3. Self Optimization (fase 6) — explícitamente NO autónoma

El prompt pide "auto-optimización". Lo que existe:
- El Recommendation Engine (ver `EDITCORE_RECOMMENDATION_ENGINE.md`) puede sugerir
  cambios basados en datos reales.
- `platform/postChangeValidator.ts` (ya existente antes de este prompt) puede
  validar cambios después de aplicados, si el usuario lo activa.

Lo que NO existe y no se fabricó: un ciclo que detecte un problema y **aplique
solo** la corrección sin intervención humana. Esto es deliberado — EditCore nunca
ejecuta comandos ni escribe archivos sin aprobación manual explícita
(`requestCommandApproval`, `showDiffAndConfirm`), y este prompt no cambia esa
garantía de seguridad.

## 4. AI Security Intelligence (fase 12) — parcial, local

**Lo real**: el rol `@security` (ya existente en `agents/roles.ts`) puede revisar
el código del workspace en busca de problemas OWASP típicos cuando se le pide. El
log de decisiones (sección 2) también permite ver, localmente, cuántos comandos
riesgosos propuso el agente y cuántos se cancelaron.

**Lo que NO existe**: "detección de anomalías y amenazas" en el sentido de
seguridad operativa (tráfico de red, intentos de intrusión, anomalías entre
usuarios) requiere telemetría de infraestructura que EditCore no tiene porque no
opera infraestructura — corre dentro del editor del usuario. No se fabricó un
sistema de detección de amenazas falso.

## 5. Resumen de lo que sigue sin existir (límite arquitectónico, no pendiente)

- Aprendizaje/reentrenamiento real del modelo.
- Aplicación autónoma de cambios sin aprobación humana.
- Detección de amenazas de infraestructura/red.
- Cualquier dato agregado entre usuarios o instalaciones distintas.

Estos cuatro puntos requieren, respectivamente: un pipeline de ML propio, remover
una garantía de seguridad central del producto, operar infraestructura de red, y
un backend con telemetría — ninguno existe en este repositorio ni se fabricó para
este prompt.
