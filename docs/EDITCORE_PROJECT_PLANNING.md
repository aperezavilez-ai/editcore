# EditCore Project Planning

Estado: **agentes reales de planificación disponibles en el IDE**.
El agente `@enterprise-architect` produce roadmaps reales, `@cost-analyst`
estima costos y `@risk-analyst` documenta riesgos — todos como output
estructurado del chat del IDE.

## 1. Proceso de planificación de proyectos

### Cómo generar un plan completo en EditCore

```
# Paso 1: análisis de negocio
@enterprise-architect Soy [empresa]. Problema: [X]. Usuarios: [N]. Presupuesto mensual: $[Y].

# Paso 2: estimación de costos
@cost-analyst basándote en la arquitectura anterior, estima costos para 3 escenarios: 
100, 1.000 y 10.000 usuarios/mes.

# Paso 3: análisis de riesgos
@risk-analyst identifica los 5 riesgos más críticos del diseño propuesto.

# Paso 4: guardar el proyecto via API
POST /api/v1/architect/projects
{ "name": "...", "business_requirements": "...", "solution_architecture": "...", ... }
```

## 2. Templates de documentos de planificación

### PROJECT_COST_ESTIMATE.md
| Componente | Costo mínimo/mes | Costo máximo/mes | Supuestos |
|---|---|---|---|
| Infraestructura (Vercel/hosting) | | | |
| Base de datos (Supabase/RDS) | | | |
| Servicios externos (email, SMS, storage) | | | |
| APIs de IA (tokens/mes estimados) | | | |
| Desarrollo (costo único o recurrente) | | | |
| Mantenimiento | | | |
| **Total estimado** | | | |

### PROJECT_RISK_REPORT.md
| Riesgo | Categoría | Probabilidad | Impacto | Mitigación |
|---|---|---|---|---|
| [Descripción] | [Seguridad/Escalabilidad/...] | Alta/Media/Baja | Alto/Medio/Bajo | [Acción concreta] |

## 3. Lo que NO existe todavía

- Generación automática de los archivos `.md` en el workspace sin que el usuario los copie manualmente del chat.
- Integración con el `EVOLUTION_ROADMAP` del sistema de evolución (Prompt 12): hoy son documentos separados.
- Estimación de tiempo de desarrollo con base en datos históricos reales de EditCore (no hay métricas de velocidad de desarrollo pasada).
