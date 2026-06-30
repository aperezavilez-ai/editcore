# EditCore Agent Network

Estado: **red implementada con APIs reales**. Equipos, comunicacion,
knowledge graph, supervisor, calidad e investigacion — todo con persistencia
en Supabase y dashboard en produccion.

## 1. Arquitectura de la red

```
┌─────────────────────────────────────────────────────────────┐
│                  EDITCORE AGENT NETWORK                     │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  AI Teams    │  │ Agent Msgs   │  │ Knowledge Graph  │  │
│  │ development  │  │ (Protocol)   │  │   Nodes+Edges    │  │
│  │ business     │  │              │  │                  │  │
│  │ research     │  └──────────────┘  └──────────────────┘  │
│  │ quality      │                                           │
│  │ enterprise   │  ┌──────────────┐  ┌──────────────────┐  │
│  └──────────────┘  │  Supervisor  │  │ Quality Control  │  │
│                    │    Agent     │  │    Network       │  │
│                    └──────────────┘  └──────────────────┘  │
│                                                             │
│                    ┌──────────────┐                         │
│                    │  Research    │                         │
│                    │  Network     │                         │
│                    └──────────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

## 2. Componentes implementados

| Componente | Endpoint | Tabla |
|---|---|---|
| Agent Teams | `/api/v1/network/teams` | `agent_teams` |
| Communication Protocol | `/api/v1/network/messages` | `agent_messages` |
| Knowledge Graph | `/api/v1/network/knowledge` | `knowledge_nodes` + `knowledge_edges` |
| Master Supervisor | `/api/v1/network/supervisor` | `supervisor_decisions` |
| Quality Control | `/api/v1/network/quality` | `quality_reviews` |
| Research Network | `/api/v1/network/research` | `research_reports` |
| Network Metrics | `/api/v1/network/metrics` | (agrega todo) |
| Dashboard | `/network-center.html` | — |

## 3. Tipos de equipos y miembros predefinidos

| Tipo | Agentes incluidos |
|---|---|
| `development` | enterprise-architect, saas-builder (x2), test-factory, maintenance-agent, release-manager |
| `business` | product-manager, enterprise-consultant, cost-analyst, risk-analyst |
| `research` | ai-architect, enterprise-architect, maintenance-agent |
| `quality` | test-factory, maintenance-agent, enterprise-architect, release-manager |
| `enterprise` | enterprise-architect, enterprise-consultant, sprint-planner |

## 4. Lo que NO existe todavía

- **Ejecucion real paralela entre agentes**: los equipos se crean y registran
  pero los agentes no se ejecutan simultaneamente en procesos separados.
  Requiere un orquestador con workers reales (queues, workers en Vercel).
- **Agentes dinamicos en runtime**: el DYNAMIC AGENT CREATOR del prompt
  es conceptualmente el rol `create_agent` en governance, pero no existe
  un proceso que instancie un nuevo agente especializado de forma autonoma.
- **Knowledge graph visual**: el grafo existe como datos pero no hay
  visualizacion de nodos/aristas en el dashboard (requiere una libreria
  como D3.js o Cytoscape.js).
