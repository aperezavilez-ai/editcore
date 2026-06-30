# EditCore Community System

Estado: **primera versión real, básica**. Ya existe una capa social mínima:
cualquiera puede leer publicaciones, y un usuario con cuenta puede publicar
y comentar.

## 1. Lo que sí existe (real, en producción)

- Tablas `community_posts` y `community_comments` (Supabase, `supabase/migrations/0005_agents_and_community.sql`), ligadas a `auth.users` (la misma cuenta individual de `login.html`/`account.html`).
- `/api/community/posts` (GET/POST) — lista publicaciones (público, sin sesión) y crea publicaciones (requiere sesión).
- `/api/community/:id/comments` (GET/POST) — lista y crea comentarios sobre una publicación.
- `web/community.html` — página real: lista publicaciones, permite expandir comentarios, y si hay sesión muestra el formulario para publicar/comentar. Enlazada desde `web/account.html`.

## 2. Lo que NO existe todavía (honesto, no inventado)

- **Perfiles públicos**: los posts/comentarios muestran un `user_id`, no un nombre o avatar público — no hay tabla de perfiles públicos todavía, solo `profiles` interno (nombre, organización).
- **Moderación**: no hay reporte de abuso, ni borrado por administradores, ni filtrado de contenido — cualquier usuario logueado puede publicar cualquier texto.
- **Foros/categorías**: es un solo listado plano de publicaciones, sin categorías ni subforos.
- **Reputación/votos**: no hay sistema de likes, votos ni karma.
- **Notificaciones**: no se avisa a nadie cuando comentan en su publicación.

## 3. Próximos pasos honestos

1. Mostrar nombre de usuario real en vez de `user_id` (join contra `profiles`, respetando que el usuario decida si su nombre es público).
2. Moderación básica: endpoint de borrado para el autor y para administradores de organización.
3. Reporte de abuso y un proceso manual de revisión antes de cualquier lanzamiento público a gran escala.
4. Categorías o etiquetas si el volumen de publicaciones lo justifica.

Esta es una comunidad funcional pero deliberadamente mínima — el objetivo
fue tener una base real sobre la que iterar, no fabricar una funcionalidad
completa de un día para otro.
