# EditCore — Business Process Engine

## Estado actual

El motor de procesos permite definir, almacenar y registrar ejecuciones de procesos de negocio. La definicion de pasos es real; la ejecucion automatica aun no existe.

## Schema de proceso

```json
{
  "name": "Onboarding de cliente nuevo",
  "trigger_type": "manual",
  "steps": [
    { "order": 1, "action": "Crear perfil en biz_customers", "agent": "customer-success-agent", "requires_approval": false },
    { "order": 2, "action": "Generar contrato", "agent": "legal-agent", "requires_approval": true },
    { "order": 3, "action": "Kick-off meeting", "agent": null, "requires_approval": false }
  ]
}
```

## Tipos de trigger

| Tipo | Descripcion | Automatizado |
|------|-------------|-------------|
| `manual` | Se ejecuta bajo demanda | No |
| `scheduled` | Se ejecuta en horario fijo | Schema listo, runner no construido |
| `event` | Se dispara por evento del sistema | No implementado |
| `webhook` | Se dispara por llamada externa | No implementado |

## API

- `GET /api/v1/enterprise/processes` — lista procesos, filtro por status
- `POST /api/v1/enterprise/processes` — crea proceso nuevo
- `PATCH /api/v1/enterprise/processes` — actualiza; con `run: true` incrementa run_count

## Lo que NO existe aún

- Runner automatico de pasos
- Historial de ejecuciones con resultado por paso
- Evaluacion de condiciones entre pasos
- Retry logic para pasos fallidos
