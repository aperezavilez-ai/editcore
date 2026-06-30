# EditCore Agent Communication Protocol

Estado: **protocolo implementado** en `agent_messages` con trazabilidad
completa. Cada mensaje queda registrado con sender, receiver, tipo,
contenido y estado.

## 1. Tipos de mensaje

| Tipo | Cuando usarlo |
|---|---|
| `request` | Solicitar trabajo o informacion a otro agente |
| `response` | Respuesta a una solicitud previa |
| `transfer` | Pasar una tarea de un agente a otro |
| `validate` | Pedir validacion de un resultado |
| `broadcast` | Mensaje a todo el equipo (receiver = null) |
| `escalate` | Escalar al supervisor o al humano |

## 2. Estructura de un mensaje

```json
{
  "sender_agent": "enterprise-architect",
  "receiver_agent": "saas-builder",
  "msg_type": "request",
  "subject": "Implementar endpoint POST /api/v1/orders",
  "content": {
    "action": "implement",
    "spec": "...",
    "priority": 1,
    "deadline": "sprint-3"
  },
  "thread_id": "uuid-del-hilo"
}
```

## 3. Ciclo de vida de un mensaje

```
sent → received → processed → (ok o failed)
```

Los mensajes `escalate` siempre terminan llegando al operador humano;
el sistema no los procesa autonomamente.

## 4. Trazabilidad

Cada mensaje incluye:
- `thread_id`: agrupa toda la conversacion entre agentes
- `parent_id`: mensaje padre para respuestas encadenadas
- `user_id`: propietario de la conversacion (RLS)
- `created_at`: timestamp inmutable

## 5. API

```
POST /api/v1/network/messages
Authorization: Bearer <token>
{ "sender_agent": "...", "receiver_agent": "...", "msg_type": "request", "subject": "...", "content": {} }

GET /api/v1/network/messages?thread_id=<uuid>
```

## 6. Seguridad

- RLS: cada usuario solo ve sus propios mensajes.
- El contenido es `jsonb` libre — el schema lo valida el llamador.
- No hay mensajes cross-user: la red de cada usuario es privada.
