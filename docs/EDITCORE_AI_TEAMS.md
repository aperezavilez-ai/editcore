# EditCore AI Virtual Teams

Estado: **implementado**. Equipos virtuales con miembros predefinidos
por tipo, almacenados en `agent_teams`, gestionables via API y dashboard.

## 1. Concepto

Un AI Team es un grupo de agentes especializados asignados a un objetivo
comun. No ejecutan tareas en paralelo autonomamente — son una estructura
de coordinacion: el `@sprint-planner` asigna tareas a los agentes del
equipo, y el supervisor resuelve conflictos entre ellos.

## 2. Equipos disponibles

### Equipo Desarrollo (`development`)
| Rol | Agente |
|---|---|
| Arquitecto IA | `@enterprise-architect` |
| Backend Agent | `@saas-builder` |
| Frontend Agent | `@saas-builder` |
| QA Agent | `@test-factory` |
| Security Agent | `@maintenance-agent` |
| DevOps Agent | `@release-manager` |

### Equipo Negocio (`business`)
| Rol | Agente |
|---|---|
| Product Agent | `@product-manager` |
| Estrategia Agent | `@enterprise-consultant` |
| Finanzas Agent | `@cost-analyst` |
| Analista Agent | `@risk-analyst` |

### Equipo Investigacion (`research`)
| Rol | Agente |
|---|---|
| AI Research Agent | `@ai-architect` |
| Tech Scout Agent | `@enterprise-architect` |
| Security Research Agent | `@maintenance-agent` |

### Equipo Calidad (`quality`)
| Rol | Agente |
|---|---|
| Code Quality Agent | `@test-factory` |
| Security QA Agent | `@maintenance-agent` |
| Architecture QA Agent | `@enterprise-architect` |
| Performance QA Agent | `@release-manager` |

### Equipo Enterprise (`enterprise`)
| Rol | Agente |
|---|---|
| Enterprise Architect | `@enterprise-architect` |
| Enterprise Consultant | `@enterprise-consultant` |
| Project Manager Agent | `@sprint-planner` |

## 3. Crear un equipo via API

```
POST /api/v1/network/teams
Authorization: Bearer <token>
{
  "name": "Equipo Alpha",
  "team_type": "development",
  "project_id": "<uuid>"
}
```

Los miembros se asignan automaticamente segun el `team_type`.
Se pueden personalizar pasando `members` como array.

## 4. Flujo tipico de un equipo de desarrollo

1. `@product-manager` genera PRODUCT_REQUIREMENTS.md
2. `@enterprise-architect` diseña la arquitectura
3. `@sprint-planner` divide en tareas y las asigna al equipo
4. `@saas-builder` implementa el codigo
5. `@test-factory` genera y verifica tests
6. `@maintenance-agent` hace revision de seguridad
7. `@release-manager` prepara el release
