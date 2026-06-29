# EditCore Developer Portal

Estado: **no implementado**. No existe ningún portal para desarrolladores
externos. Este documento lo dice sin rodeos.

## 1. Lo que sí existe

- Documentación técnica interna en `docs/*.md`, pero escrita para el propio equipo/usuario, no publicada como portal de desarrolladores con navegación, guías paso a paso o ejemplos ejecutables.
- El propio código de la extensión (`extensions/editcore-claude/`) como referencia de implementación, pero sin ningún empaquetado como "guía para terceros".

## 2. Lo que NO existe todavía (honesto, no inventado)

- **EDITCORE DEVELOPERS CENTER**: no existe ningún sitio, subdominio ni sección de `web/` dedicada a desarrolladores.
- **Documentación de API navegable**: no hay ninguna referencia de API pública que documentar (ver `EDITCORE_API_PLATFORM.md` — la API pública en sí no existe).
- **Guías y ejemplos**: no hay tutoriales de "cómo integrar con EditCore" para terceros.
- **SDKs**: no existen (ver `EDITCORE_SDK.md` no aplica aún; cubierto abajo en este mismo documento por brevedad del alcance pedido — no hay ningún paquete publicado en npm/PyPI).
- **Claves de prueba / sandbox**: no hay ningún entorno aislado de pruebas distinto de producción; ni claves de demo.
- **Comunidad técnica**: no hay foro, Discord, ni espacio de discusión para desarrolladores.

## 3. Plan honesto para implementarlo (no construido aún)

1. Sitio estático en `web/developers` con documentación generada desde una futura especificación OpenAPI.
2. Entorno sandbox: una organización de prueba con límites bajos y datos ficticios, separada de organizaciones reales.
3. Página de registro para obtener una clave de prueba automáticamente (requiere endpoint de alta automatizada, ver `EDITCORE_BUSINESS_OPERATIONS.md`).
4. Canal de comunidad (Discord o GitHub Discussions) enlazado desde el portal.

Hoy, un desarrollador externo que quiera integrarse con EditCore no tiene
ningún punto de entrada: no hay portal, no hay sandbox, no hay claves de
prueba.
