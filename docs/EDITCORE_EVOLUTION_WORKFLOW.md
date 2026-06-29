# EditCore Evolution Workflow

Estado: **niveles de aprobación definidos y aplicados en el modelo de
datos real**. Esto documenta cómo se mueve una propuesta de mejora de la
idea a la implementación, y dónde está la frontera entre "automático" y
"requiere a un humano" — frontera que es deliberada, no provisional.

## 1. Los 5 niveles (campo `level` en `evolution_proposals`)

| Nivel | Nombre | Qué significa hoy |
|---|---|---|
| 1 | Analizar | Se registró una observación o métrica preocupante, sin propuesta de solución todavía. |
| 2 | Proponer | Hay una propuesta concreta de qué cambiar, sin prototipo. |
| 3 | Crear prototipo | Existe una rama, script o página de prueba que demuestra la idea (ver `EDITCORE_AI_LAB.md`), pero no está en producción. |
| 4 | Implementar con aprobación | Un humano (el dueño del proyecto) aprobó el cambio y un humano (vía sesión de desarrollo) lo implementa y lo mergea a `main`. |
| 5 | Optimización automática limitada | Reservado para el futuro. Hoy **no hay ningún cambio que se aplique sin que un humano lo revise primero** — este nivel existe en el esquema pero no tiene ninguna automatización real detrás. |

## 2. Por qué el nivel 5 no está implementado

El Prompt 12 pide "automejora autónoma controlada". La parte de "controlada"
significa, en la práctica de este proyecto, que ningún sistema modifica
código de producción sin que una persona lo revise — la misma regla que ya
rige todo el desarrollo de EditCore (todo cambio pasa por commits, revisión
y merge explícito). Construir un nivel 5 real significaría darle a un
proceso automático permiso de escritura sobre el repositorio de producción,
lo cual es un riesgo de seguridad que no se debe activar sin una decisión
explícita y mecanismos adicionales (sandboxing, límites de alcance,
reversión automática) que hoy no existen.

## 3. Flujo real hoy

1. Una auditoría (`evolution_audits`) o una persona detecta algo a mejorar.
2. Se crea una fila en `evolution_proposals` vía `POST /api/evolution/proposals` (nivel 1 o 2).
3. Se revisa en `web/evolution.html` (Centro de Evolución).
4. Si se decide avanzar, alguien construye un prototipo fuera de producción (nivel 3) — hoy esto significa una rama de git o un script de prueba, no hay sandbox aislado todavía (ver `EDITCORE_AI_LAB.md`).
5. Si el dueño del proyecto aprueba, se implementa en una sesión de desarrollo real, se commitea, se mergea a `main` (nivel 4). El campo `status` se actualiza manualmente a `approved` y luego `implemented`.
6. El campo `outcome` se llena manualmente describiendo el resultado.

## 4. Lo que NO existe todavía (honesto, no inventado)

- Cambio automático de `status` cuando se mergea un commit relacionado (hoy es manual).
- Cualquier forma de ejecución de nivel 5.
- Notificaciones cuando una propuesta cambia de estado.
