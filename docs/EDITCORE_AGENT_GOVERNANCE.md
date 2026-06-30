# EditCore Agent Governance System

Estado: **implementado y en producción**. Las reglas base están en
`lib/aiGovernance.ts` (evaluación síncrona) y en la tabla
`ai_governance_rules` (auditables y consultables vía API).

## 1. Principio base

Todo agente opera dentro de un nivel de autonomía asignado. Ningún agente
puede elevar su propio nivel de autonomía. Acciones críticas como modificar
secrets, hacer deploys o eliminar datos tienen controles que no pueden
ser desactivados programáticamente.

## 2. Acciones controladas

| Acción | Nivel mínimo | Requiere aprobación | Notas |
|---|---|---|---|
| `read_files` | 1 | No | Siempre permitido |
| `send_message` | 1 | No | Respuestas siempre permitidas |
| `api_call` | 2 | No | APIs externas desde nivel 2 |
| `write_files` | 3 | Sí | Requiere OK humano hasta nivel 4 |
| `create_agent` | 3 | Sí | Crear agentes requiere aprobación |
| `git_commit` | 4 | Sí | Siempre requiere aprobación humana |
| `deploy` | 4 | Sí | Siempre requiere aprobación humana |
| `access_billing` | 5 | Sí | Solo nivel máximo, con aprobación |
| `delete_data` | 5 | Sí | Solo nivel máximo, con aprobación |
| `modify_secrets` | 99 | — | **NUNCA permitido autónomamente** |

## 3. Evaluación de gobernanza

```typescript
import { checkGovernance } from "./lib/aiGovernance";

const result = checkGovernance("write_files", 3);
// result.allowed = true
// result.requires_human_approval = true
// result.reason = "Escritura requiere aprobación humana hasta nivel 4."
```

## 4. Reglas personalizables

Los usuarios pueden ver las reglas base en:
```
GET /api/v1/aios/governance
```

Y verificar permisos específicos:
```
POST /api/v1/aios/governance
{ "action": "git_commit", "autonomy_level": 3 }
```

## 5. Auditoría

Cada acción crítica debe registrarse en `ai_meta_learning` con su
resultado. Esto permite al sistema aprender qué acciones tienen éxito
y cuáles generan errores, y ajustar las recomendaciones futuras.

## 6. Lo que NO existe todavía

- Reglas de gobernanza por proyecto (solo global implementado hoy).
- Webhook de notificación cuando una acción requiere aprobación humana.
- UI de aprobación en tiempo real para el operador humano.
