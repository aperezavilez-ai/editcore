# EditCore Global AI Architecture

Estado: **ecosistema completo implementado** a traves de los Prompts 11-16.
Este documento muestra la arquitectura global real de EditCore hoy.

## 1. Mapa completo del ecosistema

```
EDITCORE AI ECOSYSTEM
═══════════════════════════════════════════════════════════════

CAPA 1: IDENTIDAD Y ACCESO
  Supabase Auth (sesion) + Developer API Keys + Org API Keys
  RLS en todas las tablas

CAPA 2: NUCLEO IA (Prompt 15)
  lib/modelRouter.ts    — seleccion de modelo optimo
  lib/taskReasoning.ts  — descomposicion de objetivos
  lib/aiGovernance.ts   — permisos por nivel de autonomia

CAPA 3: RED DE AGENTES (Prompt 16)
  Agent Teams           — equipos especializados
  Communication Protocol— mensajes trazados entre agentes
  Knowledge Graph       — grafo global de conocimiento
  Master Supervisor     — coordinacion y conflictos
  Quality Control       — revision multi-dimension
  Research Network      — investigacion autonoma

CAPA 4: FABRICAS ESPECIALIZADAS
  Software Factory      — factory_projects, tasks, releases (Prompt 14)
  Enterprise Architect  — architecture_patterns, projects  (Prompt 13)
  Evolution Engine      — evolution_audits, proposals      (Prompt 12)
  Agent Marketplace     — agent_definitions, versions      (Prompt 11)
  Community             — community_posts, comments        (Prompt 11)

CAPA 5: SEGURIDAD Y GOBERNANZA
  ai_governance_rules   — que puede hacer cada agente
  Niveles de autonomia  1-5
  Auditoria             — ai_meta_learning, supervisor_decisions

CAPA 6: OBSERVABILIDAD
  /command-center.html  — AI OS metrics (Prompt 15)
  /network-center.html  — AI Network metrics (Prompt 16)
  /evolution.html       — Evolution dashboard (Prompt 12)
  /factory.html         — Software Factory dashboard (Prompt 14)
```

## 2. Tablas en produccion (total: 35+)

| Grupo | Tablas |
|---|---|
| Auth/Org | `organizations`, `profiles`, `developer_api_keys` |
| Agents | `agent_definitions`, `agent_versions` |
| Community | `community_posts`, `community_comments` |
| Evolution | `evolution_audits`, `evolution_proposals` |
| Architecture | `architecture_patterns`, `architecture_projects` |
| Factory | `factory_projects`, `factory_tasks`, `factory_releases`, `factory_components` |
| AI OS | `ai_orchestration_runs`, `ai_task_plans`, `ai_model_usage`, `ai_agent_activations`, `ai_governance_rules`, `ai_meta_learning`, `ai_knowledge_snapshots` |
| Network | `agent_teams`, `agent_messages`, `knowledge_nodes`, `knowledge_edges`, `research_reports`, `quality_reviews`, `supervisor_decisions` |

## 3. Endpoints de API (total: 30+)

| Grupo | Endpoints |
|---|---|
| Auth | `/api/v1/me` |
| Agents | `/api/v1/agents/`, `/api/v1/agents/[id]/versions` |
| Community | `/api/community/posts`, `/api/community/[id]/comments` |
| Evolution | `/api/evolution/audit`, `/api/evolution/audits`, `/api/evolution/proposals` |
| Architecture | `/api/v1/architect/patterns`, `/api/v1/architect/projects` |
| Factory | `/api/v1/factory/projects`, `/api/v1/factory/tasks`, `/api/v1/factory/releases` |
| AI OS | `/api/v1/aios/orchestrate`, `runs`, `task-plan`, `model-router`, `governance`, `metrics` |
| Network | `/api/v1/network/teams`, `messages`, `knowledge`, `supervisor`, `quality`, `research`, `metrics` |

## 4. Principios de la arquitectura

1. **Nada fabricado**: todo lo que existe es real y usable hoy.
2. **Human-in-the-loop**: acciones criticas siempre requieren aprobacion.
3. **Trazabilidad total**: cada decision, mensaje y accion queda registrada.
4. **RLS everywhere**: cada tabla tiene Row Level Security habilitado.
5. **Documentacion honesta**: lo que no existe se documenta como pendiente.
