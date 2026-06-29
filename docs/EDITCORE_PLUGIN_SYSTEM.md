# EditCore Plugin System

Estado: **no implementado**. No existe ningún mecanismo de plugins de
terceros, ni para la extensión de VS Code ni para el backend.

## 1. Lo que sí existe

- La extensión de VS Code (`extensions/editcore-claude/`) tiene una arquitectura interna de "roles"/agentes (`src/agents/roles.ts`) y comandos, pero es código propio compilado dentro de la extensión — no un sistema de carga de plugins de terceros en tiempo de ejecución.
- VS Code en sí permite instalar extensiones de terceros a través de su propio marketplace — pero eso es infraestructura de Microsoft, no algo que EditCore controle ni extienda con un sistema de plugins propio.

## 2. Lo que NO existe todavía (honesto, no inventado)

- **EDITCORE PLUGIN MARKETPLACE**: no existe ningún catálogo, registro ni mecanismo de publicación de plugins de terceros.
- **Sistema de permisos por plugin**: no hay ningún modelo de scopes/permisos que un plugin externo pueda solicitar.
- **Versionado de plugins**: no hay ningún esquema de versiones semánticas gestionado por EditCore para plugins.
- **Revisión de seguridad de plugins**: no hay ningún proceso de escaneo o aprobación.
- **API de extensión en tiempo de ejecución**: el código de la extensión no expone ningún punto de entrada (`registerPlugin`, hooks, etc.) donde un tercero pueda inyectar comportamiento sin modificar el código fuente de EditCore directamente.

## 3. Plan honesto para implementarlo (no construido aún)

1. Definir una interfaz de plugin (ej. un `package.json` con un campo `editcorePlugin` + un punto de entrada `activate(api)`), similar al modelo de extensiones de VS Code.
2. Tabla `plugins` en Supabase (id, nombre, autor, versión, permisos declarados, estado de revisión).
3. Proceso de revisión manual (al menos en una primera etapa) antes de publicar cualquier plugin.
4. Sandbox de ejecución o, como mínimo, declaración explícita y visible de permisos antes de instalar un plugin.

Hoy no hay ningún plugin de terceros, ni manera de crear uno, instalarlo o
publicarlo.
