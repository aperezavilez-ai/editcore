# EditCore — AI Organization

## Organigrama por defecto

Al llamar `POST /api/v1/enterprise/org-chart?init=true` se crean 11 roles:

| Nivel | Rol | Departamento | Tipo |
|-------|-----|-------------|------|
| 1 | CEO / Director General | executive | Humano |
| 2 | CTO | technology | Humano |
| 2 | COO | operations | Humano |
| 3 | AI Orchestrator | technology | Agente IA |
| 3 | Quality Director | quality | Humano |
| 3 | Business Developer | business | Humano |
| 4 | Senior Developer Agent | technology | Agente IA |
| 4 | Research Agent | research | Agente IA |
| 4 | Process Automation Agent | operations | Agente IA |
| 4 | Customer Success Agent | business | Agente IA |
| 5 | Junior Developer Agent | technology | Agente IA |

## Integracion con Agent Network

Los `agent_slug` del organigrama corresponden a agentes registrados en `agent_teams` (Prompt 16). Los agentes del organigrama pueden recibir tareas via supervisor y comunicarse por el protocolo de mensajes.

## Niveles de autonomia

Los roles de agentes tienen autonomia asignada segun su nivel:
- Nivel 3-4 (supervisor): autonomia 4 (Operador autonomo)
- Nivel 4 (ejecutor): autonomia 3 (Ejecutor supervisado)
- Nivel 5 (junior): autonomia 2 (Analista)

## Lo que NO existe aún

- Asignacion automatica de tareas segun disponibilidad del agente
- Escalacion automatica por jerarquia del organigrama
- Metricas de desempeno por rol
