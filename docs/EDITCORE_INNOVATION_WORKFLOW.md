# EditCore — Innovation Workflow

## Flujo completo del laboratorio de innovacion

```
SEÑAL / OPORTUNIDAD
      |
      v
Trend Intelligence (lab_trend_signals)
  + Research Report (lab_research_reports)
      |
      v
Idea Generation (lab_ideas) — problema, solucion, mercado
      |
      v
Idea Validation (PATCH /lab/ideas con validation_scores)
  demand + competition + cost + tech_feasibility + commercial → overall score
  >= 70: validated | < 40: rejected | resto: validating
      |
      v [si validated]
Experiment (lab_experiments)
  hipotesis → metodo → resultados → aprendizajes
      |
      v [si experimento exitoso]
Prototype (lab_prototypes)
  mvp/poc/demo → stack → demo_url
      |
      v [si prototipo funciona]
Startup Builder (lab_startups)
  concepto + modelo negocio → simulacion financiera automatica
      |
      v
Innovation Memory (lab_innovation_memory)
  guardar patrones, decisiones, exitos y fracasos del ciclo
```

## Integracion con otros sistemas EditCore

| Sistema | Como conecta |
|---------|-------------|
| Software Factory (Prompt 14) | Una idea validada y prototipada puede convertirse en factory_project |
| Agent Network (Prompt 16) | research_reports de /lab/research se complementan con los de /network/research |
| Enterprise OKRs (Prompt 17) | Ideas de alto potencial se vinculan a OKRs estrategicos |
| Quality Reviews (Prompt 16) | Prototipos pueden evaluarse con quality_reviews |
| AI OS Orchestrator (Prompt 15) | El Innovation Engine puede ser una tarea de orquestacion |

## Metricas del Innovation Center

`GET /api/v1/lab/metrics` devuelve:
- Ideas: total, validadas, construyendo, alto potencial
- Experimentos: total, corriendo, completados, fallidos
- Prototipos: total, construyendo, terminados
- Tendencias: total, creciendo, score promedio de oportunidad
- Startups: total, lanzadas
- Memoria: total de aprendizajes guardados

## Lo que NO existe aun

- Pipeline automatico de idea -> experimento -> prototipo sin intervencion humana
- Scoring de ideas por LLM basado en datos reales del mercado
- Conexion directa idea validada -> factory_project (requiere accion manual hoy)
- Dashboard con visualizacion de flujo (kanban o timeline de ideas)
