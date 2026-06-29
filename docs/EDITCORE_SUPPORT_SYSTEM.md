# EditCore Support System

Estado: **no implementado**. No existe ningún sistema de soporte (ni humano
ni con IA local) dentro de EditCore hoy. Este documento es honesto sobre esa
ausencia, sin fingir un asistente de soporte que no existe.

## 1. Lo que sí existe

- Documentación técnica en `docs/` (este archivo y sus equivalentes) que describe honestamente el estado real del producto.
- Mensajes de error descriptivos en los endpoints reales (`/api/org/plan`, `/api/usage/track`, `/api/usage/summary`) cuando la clave de organización falta o es inválida (`401` con JSON `{"error": "..."}`).
- Mensajes de advertencia en la extensión de VS Code cuando una operación falla (ej. "EditCore: la clave no pudo validarse contra el backend.").

## 2. Lo que NO existe todavía (honesto, no inventado)

- **Asistente de soporte con IA / RAG local**: no hay ninguna base de conocimiento indexada, ningún pipeline de embeddings, ningún endpoint de búsqueda semántica sobre documentación. La idea de "soporte con IA local" mencionada en el plan original no tiene ningún código asociado.
- **Sistema de tickets**: no hay tabla en Supabase, ni endpoint, ni interfaz para que un cliente abra un ticket de soporte.
- **Chat en vivo**: no existe ningún widget de chat ni integración con terceros (Intercom, Zendesk, etc.).
- **Base de conocimiento pública**: no hay sección de FAQ ni artículos de ayuda publicados en el sitio web (`web/`).
- **Canal de soporte por correo/Slack**: no hay ninguna dirección de soporte monitoreada automáticamente ni integración configurada.

## 3. Plan honesto para implementarlo (no construido aún)

1. Tabla `support_tickets` en Supabase (organization_id, subject, body, status, created_at).
2. Endpoint `/api/support/tickets` (POST para crear, GET para listar los de la organización autenticada).
3. Indexar la documentación de `docs/` con embeddings (ej. `pgvector` en Supabase) para responder preguntas básicas antes de escalar a un humano.
4. Comando en la extensión ("EditCore: Reportar un problema") que cree un ticket usando la clave de organización ya existente.
5. Notificación por correo cuando se crea un ticket (requiere un proveedor de email, ej. Resend o SendGrid, no configurado todavía).

Ninguno de estos pasos está implementado. Hoy, el "soporte" de EditCore es
exclusivamente la documentación estática del repositorio.
