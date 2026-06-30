# EditCore Development Sprint System (Prompt 21 — Fases 6, 11, 12)

Proceso real que se debe seguir para ejecutar las tareas de `EDITCORE_MASTER_ROADMAP.md`, sin cambios masivos sin control.

## Estructura de un sprint (Fase 6)

Cada sprint = una tarea del roadmap (ej. "P1.1 — Suite mínima de tests"). Plantilla:

```
### Sprint: <id> — <título>
- Objetivo: <1 frase, igual al roadmap>
- Tareas: <lista concreta de archivos a crear/modificar>
- Cambios: <diff real, no descripción vaga>
- Pruebas: <comando ejecutado y resultado, ej. "npx tsc --noEmit → sin errores">
- Validación: <quién/qué confirma que está bien — usuario, CI, o ambos>
- Documentación: <qué doc se actualiza junto con el código>
```

No se inicia un sprint de Prioridad N+1 sin que el de Prioridad N relevante esté validado.

## Seguridad y control antes de modificar (Fase 11)

EditCore no tiene infraestructura de backup propia (ni falta le hace) porque **git ya es el sistema de backup y punto de restauración real**:

- Cada sprint se entrega como uno o más commits descriptivos en la rama de trabajo — nunca se reescribe historia (`git commit --amend` solo si el usuario lo pide explícitamente).
- Antes de cualquier cambio destructivo (eliminar archivos, modificar datos en producción), se debe pedir confirmación explícita al usuario — regla ya vigente en esta sesión y reafirmada aquí para `EDITCORE_GAP_ANALYSIS.md` (P2.2, consolidación de docs).
- Para cambios de base de datos: las migraciones son aditivas y secuenciales (`0001` → `0013` →...); no se modifica una migración ya aplicada, se crea una nueva.
- "Registro de cambios" = `EDITCORE_CHANGE_LOG.md` (Fase 7) + historial real de git (`git log`), no un sistema paralelo.

## Validación continua (Fase 7, proceso)

Después de cada cambio de código:

1. **Revisión de código**: lectura del diff antes de commitear (manual en esta sesión; automatizable a futuro con un Code Review Agent real, ver `EDITCORE_DEV_AGENTS.md`).
2. **Pruebas**: `npx tsc --noEmit` como mínimo obligatorio hoy; tests unitarios cuando existan (P1.1).
3. **Seguridad**: verificar que toda tabla nueva tenga RLS, que ningún secreto se escriba en el repo (regla ya aplicada en todos los prompts anteriores).
4. **Rendimiento**: para endpoints de agregación, verificar que las consultas usen `Promise.all` (patrón ya consistente en `dco/metrics.ts`, `dco/executive.ts`, `global/command-center.ts`).
5. **Compatibilidad**: confirmar que no se rompe ningún endpoint/dashboard existente (sin tests automatizados, esto hoy es revisión manual de los archivos que consumen lo modificado).

Cada resultado de esta validación se registra en `EDITCORE_CHANGE_LOG.md`.

## Entrega final de cada sprint (Fase 12)

Al cerrar un sprint, se reporta al usuario (en el chat, no necesariamente en un archivo aparte salvo que sea un prompt completo como este):

1. Resumen de cambios.
2. Archivos modificados/creados (lista real, no estimada).
3. Nuevas funciones (si las hay).
4. Pruebas realizadas (comando + resultado).
5. Problemas encontrados (si los hay, honestamente, no minimizados).
6. Próximos pasos (siguiente tarea del roadmap).
