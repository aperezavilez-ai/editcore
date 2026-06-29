# EditCore Community System

Estado: **no implementado**. No existe ninguna comunidad, foro, perfil de
usuario ni mecanismo de colaboración pública en EditCore.

## 1. Lo que sí existe

- Un repositorio único de código (`aperezavilez-ai/editcore`), que técnicamente es colaborativo a nivel de control de versiones (issues/PRs de GitHub), pero eso es infraestructura de GitHub, no una "comunidad EditCore" propia.
- Ningún sistema de perfiles de usuario: la única identidad hoy es la organización (clave compartida), no el usuario individual (ver `EDITCORE_SAAS_ARCHITECTURE.md` §5 — no hay autenticación de usuario final).

## 2. Lo que NO existe todavía (honesto, no inventado)

- **Perfiles de usuario**: no hay tabla, ni login individual; toda la autenticación actual es por organización, no por persona.
- **Compartir proyectos/agentes**: no hay ningún mecanismo para que un usuario publique un proyecto o agente para que otros lo vean.
- **Foros / espacios de discusión**: no existen.
- **Publicación de conocimiento**: no hay blog, ni wiki pública, ni sección de artículos de la comunidad.
- **Colaboración entre organizaciones**: cada organización está aislada por RLS; no hay ningún mecanismo de visibilidad cruzada ni compartición intencional entre organizaciones.

## 3. Plan honesto para implementarlo (no construido aún)

1. Requiere primero autenticación de usuario individual (OAuth/login), que no existe — es prerrequisito real, no opcional.
2. Tabla `community_posts` o similar, con visibilidad pública opcional por recurso (agente, proyecto).
3. Página web de comunidad en `web/community` para navegar publicaciones.
4. Moderación básica antes de cualquier lanzamiento público (filtrado de contenido, reporte de abuso).

Hoy EditCore no tiene ninguna capa social o comunitaria; es una herramienta
de uso individual/organizacional sin interacción entre usuarios distintos.
