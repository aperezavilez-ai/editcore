# EditCore AI Lab

Estado: **no implementado como entorno aislado**. El Prompt 12 pide un
laboratorio donde probar funciones nuevas, crear prototipos y comparar
soluciones "sin afectar producción". Hoy esa separación existe solo a
nivel de proceso de desarrollo (ramas de git), no como una infraestructura
de sandbox dedicada.

## 1. Lo que sí existe (real, y que ya cumple parte de la necesidad)

- **Ramas de git** (`claude/...` y feature branches): todo cambio se desarrolla fuera de `main` y se mergea explícitamente — esto ya separa "experimento" de "producción" a nivel de código.
- **`evolution_proposals.level = 3`** ("crear prototipo", ver `EDITCORE_EVOLUTION_WORKFLOW.md`): existe el campo para marcar que una propuesta está en fase de prototipo, aunque el prototipo en sí vive en una rama, no en un entorno aislado dedicado.
- Supabase soporta *branches* de base de datos (entornos aislados con su propio esquema) — disponible vía la API de Supabase, pero **no se ha creado ninguno para EditCore todavía**.

## 2. Lo que NO existe todavía (honesto, no inventado)

- **Entorno de pruebas aislado con datos de prueba**: no hay un proyecto/branch de Supabase separado del de producción; todo el desarrollo apunta a la misma base de datos real (ver también `EDITCORE_DEVELOPER_PORTAL.md` — tampoco hay sandbox para claves de desarrollador).
- **Comparación automática de soluciones**: no hay ninguna herramienta que corra dos implementaciones en paralelo y compare resultados.
- **Despliegues de preview con datos sintéticos**: Vercel sí genera URLs de preview por cada PR automáticamente (eso es una capacidad de la plataforma, no algo que EditCore construyó), pero esos previews usan la misma base de datos de producción si no se configura lo contrario — riesgo real a tener en cuenta antes de experimentar con cambios que escriban datos.

## 3. Próximos pasos honestos

1. Crear un Supabase Branch real para desarrollo/pruebas, separado de producción (técnicamente disponible hoy vía `mcp__Supabase__create_branch`, no usado todavía para este propósito).
2. Configurar variables de entorno de preview en Vercel para que apunten a ese branch de Supabase en vez de producción.
3. Solo después de lo anterior, un prototipo de nivel 3 (ver workflow) podría probarse contra datos reales sin riesgo de afectar producción.

Hasta entonces, cualquier "experimento" en EditCore debe tratarse con el
mismo cuidado que un cambio de producción, porque técnicamente comparte la
misma base de datos.
