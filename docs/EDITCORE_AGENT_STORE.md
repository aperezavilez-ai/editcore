# EditCore Agent Store

Estado: **no implementado**. No existe ninguna tienda de agentes, ni
mecanismo de publicación, valoración o licenciamiento de agentes de IA.

## 1. Lo que sí existe

- Agentes/roles predefinidos dentro de la extensión (`extensions/editcore-claude/src/agents/roles.ts`, `src/verticals/verticalCommands.ts`): son configuraciones de prompts y comportamiento creadas por el propio equipo de EditCore, fijas en el código de la extensión.
- Estos "agentes" no son recursos independientes con su propio ciclo de vida (no se pueden publicar, versionar ni instalar por separado del binario de la extensión).

## 2. Lo que NO existe todavía (honesto, no inventado)

- **EDITCORE AGENT STORE**: no existe ningún catálogo público de agentes.
- **Publicación de agentes por terceros**: no hay ningún formato de exportación/empaquetado de un agente como artefacto independiente, ni endpoint para subirlo.
- **Categorías, valoraciones, versiones, actualizaciones, licencias**: ninguno de estos conceptos tiene modelo de datos ni interfaz.
- **Monetización de agentes**: no hay ningún mecanismo de pago asociado a un agente individual (distinto del cobro por plan general, que tampoco existe aún realmente — ver `EDITCORE_BILLING_SYSTEM.md`).

## 3. Plan honesto para implementarlo (no construido aún)

1. Definir un formato serializable de "agente" (ej. JSON: nombre, prompt de sistema, herramientas permitidas, modelo recomendado) separado del código fuente de la extensión.
2. Tabla `agents` en Supabase (autor, versión, categoría, licencia, estado de publicación).
3. Endpoint para publicar/listar/instalar agentes desde la extensión.
4. Sistema de valoraciones (tabla `agent_reviews`) y de versionado (ver también `EDITCORE_AGENT_VERSION_CONTROL`, no implementado).

Hoy todos los agentes de EditCore son fijos, creados por el equipo interno,
y no hay forma de que un tercero publique uno.
